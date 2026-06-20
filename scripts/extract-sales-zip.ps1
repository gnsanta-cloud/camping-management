# xlsx(zip)에서 일별 매출(날짜 행 바로 위 금액) 추출 - Excel COM 불필요
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$xlsxPath = (Get-ChildItem "d:\Camping\*.xlsx" | Select-Object -First 1).FullName
$outJson = "d:\Camping\js\legacy-sales.json"
$outJs = "d:\Camping\js\legacy-sales.js"
$tempDir = Join-Path $env:TEMP ("camping-xlsx-" + [guid]::NewGuid().ToString("N"))

function Get-Num($val) {
    if ($null -eq $val) { return 0 }
    $s = ($val -replace "[^0-9]", "")
    if ($s -eq "") { return 0 }
    return [long]$s
}

function Get-DateFromCell($txt, $year, $defaultMonth) {
    $t = $txt.Trim()
    if (-not $t -or $t -eq "-") { return $null }
    if ($t -match "(\d{1,2}).*?(\d{1,2})") {
        $m = [int]$Matches[1]; $d = [int]$Matches[2]
        if ($m -ge 1 -and $m -le 12 -and $d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $m, $d)
        }
    }
    if ($defaultMonth -and $t -match "(\d{1,2})") {
        $d = [int]$Matches[1]
        if ($d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $defaultMonth, $d)
        }
    }
    return $null
}

function Get-SharedStrings($dir) {
    $path = Join-Path $dir "xl\sharedStrings.xml"
    if (-not (Test-Path $path)) { return @() }
    [xml]$x = Get-Content $path -Encoding UTF8
    $list = @()
    foreach ($si in $x.sst.si) {
        if ($si.t) { $list += [string]$si.t }
        elseif ($si.r) { $list += (($si.r | ForEach-Object { $_.t }) -join "") }
        else { $list += [string]$si.InnerText }
    }
    return $list
}

function Get-CellValue($cell, $shared) {
    $t = $cell.t
    $v = $cell.v
    if ($t -eq "s" -and $null -ne $v) {
        $idx = [int]$v
        if ($idx -lt $shared.Count) { return [string]$shared[$idx] }
    }
    if ($null -ne $v) { return [string]$v }
    return ""
}

function Get-SheetRows($sheetPath, $shared) {
    [xml]$xml = Get-Content $sheetPath -Encoding UTF8
    $rows = @{}
    foreach ($row in $xml.worksheet.sheetData.row) {
        $rIdx = [int]$row.r
        $cells = @{}
        foreach ($c in $row.c) {
            $ref = [string]$c.r
            if ($ref -match "^([A-Z]+)") {
                $col = $Matches[1]
                $cells[$col] = Get-CellValue $c $shared
            }
        }
        $rows[$rIdx] = $cells
    }
    return $rows
}

function Col-ToIndex($col) {
    $n = 0
    foreach ($ch in $col.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - [int][char]'A' + 1) }
    return $n
}

function Get-Cell($rows, $r, $c) {
    $col = ""
    $n = $c
    while ($n -gt 0) {
        $n--; $col = [char]([int][char]'A' + ($n % 26)) + $col; $n = [Math]::Floor($n / 26)
    }
    if ($rows.ContainsKey($r) -and $rows[$r].ContainsKey($col)) { return [string]$rows[$r][$col] }
    return ""
}

function Find-HeaderRow($rows, $maxRow, $maxCol, $year, $defaultMonth) {
    for ($r = 1; $r -le [Math]::Min(12, $maxRow); $r++) {
        $count = 0
        for ($c = 3; $c -le $maxCol; $c++) {
            if (Get-DateFromCell (Get-Cell $rows $r $c) $year $defaultMonth) { $count++ }
        }
        if ($count -ge 1) { return $r }
    }
    return 0
}

function Test-PairLayout($rows, $headerRow, $maxCol) {
    $a = (Get-Cell $rows ($headerRow + 1) 3).Trim()
    $b = (Get-Cell $rows ($headerRow + 1) 4).Trim()
    if (-not $a -or -not $b) { return $false }
    return ((Get-Num $a) -eq 0 -and (Get-Num $b) -eq 0)
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $tempDir)
[xml]$wbXml = Get-Content (Join-Path $tempDir "xl\workbook.xml") -Encoding UTF8
[xml]$rels = Get-Content (Join-Path $tempDir "xl\_rels\workbook.xml.rels") -Encoding UTF8
$shared = Get-SharedStrings $tempDir

$sheetMap = @{}
foreach ($rel in $rels.Relationships.Relationship) {
    if ($rel.Target -like "worksheets/*") {
        $sheetMap[$rel.Id] = Join-Path $tempDir ("xl\" + ($rel.Target -replace "/", "\"))
    }
}

$allSales = @()
$saleId = 1
$sheetIndex = 0

foreach ($sh in $wbXml.workbook.sheets.sheet) {
    $sheetIndex++
    if ($sheetIndex -le 2) { continue }
    $name = [string]$sh.name
    $rid = $sh.'_rid'
    $path = $sheetMap[$rid]
    if (-not (Test-Path $path)) { continue }

    $year = 2025
    $defaultMonth = $null
    if ($name -match "(20\d{2})") { $year = [int]$Matches[1] }
    if ($name -match "(\d{1,2})") {
        $mo = [int]$Matches[1]
        $defaultMonth = $mo
        if ($mo -ge 6) { $year = 2024 } else { $year = 2025 }
    }

    $rows = Get-SheetRows $path $shared
    if ($rows.Count -eq 0) { continue }
    $maxRow = ($rows.Keys | Measure-Object -Maximum).Maximum
    $maxCol = 80

    $headerRow = Find-HeaderRow $rows $maxRow $maxCol $year $defaultMonth
    if ($headerRow -lt 2) { continue }

    $totalRow = $headerRow - 1
    $pairLayout = Test-PairLayout $rows $headerRow $maxCol

    for ($c = 3; $c -le $maxCol; $c++) {
        $dateStr = Get-DateFromCell (Get-Cell $rows $headerRow $c) $year $defaultMonth
        if (-not $dateStr) { continue }

        $total = Get-Num (Get-Cell $rows $totalRow $c)
        if ($total -le 0 -and $pairLayout) { $total = Get-Num (Get-Cell $rows $totalRow ($c + 1)) }
        if ($total -le 0) { continue }

        $allSales += @{
            id = "legacy-$saleId"
            date = $dateStr
            time = "excel"
            items = @()
            total = $total
            received = $total
            change = 0
            source = "excel"
            legacy = $true
            sheet = $name
            createdAt = ($dateStr + "T12:00:00.000Z")
        }
        $saleId++
    }
}

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$json = $allSales | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outJson, $json, (New-Object System.Text.UTF8Encoding $false))
[System.IO.File]::WriteAllText($outJs, "const LEGACY_SALES = " + $json + ";", (New-Object System.Text.UTF8Encoding $false))
Write-Output ("OK count=" + $allSales.Count)
