$ErrorActionPreference = "Continue"
$xlsxPath = "d:\Camping\source.xlsx"

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
        $dateCount = 0
        for ($c = 3; $c -le $maxCol; $c++) {
            $dt = Get-DateFromCell (Get-CellText $ws $r $c) $year $defaultMonth
            if ($dt) { $dateCount++ }
        }
        if ($dateCount -ge 1) { return $r }
    }
    return 0
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)

$sheetIndex = 0
foreach ($ws in $wb.Worksheets) {
    $sheetIndex++
    if ($sheetIndex -le 2) { continue }

    $year = 2025
    $defaultMonth = $null
    $sn = $ws.Name
    if ($sn -match "(20\d{2})") { $year = [int]$Matches[1] }
    if ($sn -match "(\d{1,2})") {
        $mo = [int]$Matches[1]
        $defaultMonth = $mo
        if ($mo -ge 6) { $year = 2024 } else { $year = 2025 }
    }

    try { $maxRow = $ws.UsedRange.Rows.Count } catch { continue }
    try { $maxCol = [Math]::Min($ws.UsedRange.Columns.Count, 20) } catch { $maxCol = 20 }
    if ($maxRow -lt 3) { continue }

    $headerRow = Find-HeaderRow $ws $maxRow $maxCol $year $defaultMonth
    $count = 0
    if ($headerRow -ge 2) {
        $totalRow = $headerRow - 1
        for ($c = 3; $c -le $maxCol; $c++) {
            $dateStr = Get-DateFromCell (Get-CellText $ws $headerRow $c) $year $defaultMonth
            if (-not $dateStr) { continue }
            $total = Get-Num (Get-CellText $ws $totalRow $c)
            if ($total -gt 0) { $count++ }
        }
    }
    Write-Output ("sheet={0} name={1} headerRow={2} year={3} month={4} count={5}" -f $sheetIndex, $sn, $headerRow, $year, $defaultMonth, $count)

    if ($sheetIndex -eq 14) {
        Write-Output "--- June sample cols 1-10 row 1-4 ---"
        for ($r = 1; $r -le 4; $r++) {
            $parts = @()
            for ($c = 1; $c -le 10; $c++) {
                $parts += ("C{0}='{1}'" -f $c, (Get-CellText $ws $r $c))
            }
            Write-Output ("R{0}: {1}" -f $r, ($parts -join " | "))
        }
    }
}

$wb.Close($false)
$excel.Quit()
