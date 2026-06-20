$ErrorActionPreference = "Continue"
$xlsxPath = if (Test-Path "d:\Camping\source.xlsx") { "d:\Camping\source.xlsx" } else { (Get-ChildItem "d:\Camping\*.xls*" | Select-Object -First 1).FullName }
$outJson = "d:\Camping\js\legacy-sales.json"
$outJs = "d:\Camping\js\legacy-sales.js"

function Get-Num($val) {
    if ($null -eq $val) { return 0 }
    $s = ($val.ToString() -replace "[^0-9]", "")
    if ($s -eq "") { return 0 }
    return [long]$s
}

function Get-CellText($ws, $r, $c) {
    try {
        $v = $ws.Cells.Item($r, $c).Text
        if ($null -eq $v) { return "" }
        return $v.ToString().Trim()
    } catch { return "" }
}

function Get-DateFromCell($txt, $year, $defaultMonth) {
    if ([string]::IsNullOrWhiteSpace($txt) -or $txt -eq "-") { return $null }
    $numOnly = ($txt -replace "[^0-9]", "")
    if ($txt -match "^[\d,.\s]+$" -and $numOnly.Length -ge 4) { return $null }

    if ($txt -match "(\d{1,2}).*?(\d{1,2})") {
        $m = [int]$Matches[1]; $d = [int]$Matches[2]
        if ($m -ge 1 -and $m -le 12 -and $d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $m, $d)
        }
    }
    if ($defaultMonth -and $txt -notmatch "," -and $txt.Length -le 8 -and $txt -match "^(\d{1,2})") {
        $d = [int]$Matches[1]
        if ($d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $defaultMonth, $d)
        }
    }
    return $null
}

function Find-HeaderRow($ws, $maxRow, $maxCol, $year, $defaultMonth) {
    for ($r = 1; $r -le [Math]::Min(12, $maxRow); $r++) {
        $labelB = Get-CellText $ws $r 2
        if ($labelB.Length -ge 2) { return $r }
    }
    for ($r = 1; $r -le [Math]::Min(12, $maxRow); $r++) {
        $dateCount = 0
        for ($c = 3; $c -le $maxCol; $c++) {
            $dt = Get-DateFromCell (Get-CellText $ws $r $c) $year $defaultMonth
            if ($dt) { $dateCount++ }
        }
        if ($dateCount -ge 1) { return $r }
    }
    return 0
}

function Test-PairLayout($ws, $headerRow, $maxCol) {
    $sub = $headerRow + 1
    for ($c = 3; $c -le [Math]::Min($maxCol, $headerRow + 20); $c++) {
        $t = Get-CellText $ws $sub $c
        if ($t.Length -eq 2) { return $true }
    }
    return $false
}

function Get-SheetYear($sheetName, $month) {
    if ($sheetName -match "(20\d{2})") { return [int]$Matches[1] }
    if ($null -ne $month) {
        if ($month -ge 10 -and $month -le 12) { return 2025 }
        if ($month -ge 1 -and $month -le 6) { return 2026 }
        return 2026
    }
    return 2026
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsxPath)

$allSales = @()
$saleId = 1
$sheetIndex = 0

foreach ($ws in $wb.Worksheets) {
    $sheetIndex++
    if ($sheetIndex -le 2) { continue }

    $sn = $ws.Name
    try {
        $defaultMonth = $null
        if ($sn -match "(\d{1,2})") { $defaultMonth = [int]$Matches[1] }
        $year = Get-SheetYear $sn $defaultMonth

        try { $maxRow = $ws.UsedRange.Rows.Count } catch { continue }
        try { $maxCol = [Math]::Min($ws.UsedRange.Columns.Count, 120) } catch { $maxCol = 80 }
        if ($maxRow -lt 3) { continue }

        $headerRow = Find-HeaderRow $ws $maxRow $maxCol $year $defaultMonth
        if ($headerRow -lt 2) { continue }

        $totalRow = $headerRow - 1
        $pairLayout = Test-PairLayout $ws $headerRow $maxCol
        $subRow = $headerRow + 1

        for ($c = 3; $c -le $maxCol; $c++) {
            $dateStr = Get-DateFromCell (Get-CellText $ws $headerRow $c) $year $defaultMonth
            if (-not $dateStr) { continue }

            $total = Get-Num (Get-CellText $ws $totalRow $c)
            if ($total -le 0 -and $pairLayout) {
                $total = Get-Num (Get-CellText $ws $totalRow ($c + 1))
            }
            if ($total -le 0) { continue }

            $allSales += [ordered]@{
                id = "legacy-$saleId"
                date = $dateStr
                time = "excel"
                items = @()
                total = $total
                received = $total
                change = 0
                source = "excel"
                legacy = $true
                sheet = $sn
                createdAt = ($dateStr + "T12:00:00.000Z")
            }
            $saleId++
        }
    } catch {
        Write-Warning ("Sheet " + $sn + ": " + $_.Exception.Message)
    }
}

try { $wb.Close($false) } catch { }
try { $excel.Quit() } catch { }
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

$json = $allSales | ConvertTo-Json -Depth 5
if (-not $json) { $json = "[]" }
[System.IO.File]::WriteAllText($outJson, $json, (New-Object System.Text.UTF8Encoding $false))
[System.IO.File]::WriteAllText($outJs, "const LEGACY_SALES = " + $json + ";", (New-Object System.Text.UTF8Encoding $false))
Write-Output ("OK count=" + $allSales.Count)
