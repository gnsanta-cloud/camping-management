$xlsxPath = "d:\Camping\source.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)

function Get-Num($val) {
    if ($null -eq $val) { return 0 }
    $s = ($val.ToString() -replace "[^0-9]", "")
    if ($s -eq "") { return 0 }
    return [long]$s
}
function Get-CellText($ws, $r, $c) {
    try { return $ws.Cells.Item($r, $c).Text.ToString().Trim() } catch { return "" }
}
function Get-DateFromCell($txt, $year, $defaultMonth) {
    if ([string]::IsNullOrWhiteSpace($txt) -or $txt -eq "-") { return $null }
    if ($txt -match "(\d{1,2}).*?(\d{1,2})") {
        $m = [int]$Matches[1]; $d = [int]$Matches[2]
        if ($m -ge 1 -and $m -le 12 -and $d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $m, $d)
        }
    }
    if ($defaultMonth -and $txt -match "(\d{1,2})") {
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
            if (Get-DateFromCell (Get-CellText $ws $r $c) $year $defaultMonth) { $dateCount++ }
        }
        if ($dateCount -ge 1) { return $r }
    }
    return 0
}

$idx = 0
$total = 0
foreach ($ws in $wb.Worksheets) {
    $idx++
    if ($idx -le 2) { continue }
    $year = 2025; $defaultMonth = $null
    if ($ws.Name -match "(\d{1,2})") { $defaultMonth = [int]$Matches[1]; if ($defaultMonth -ge 6) { $year = 2024 } }
    $maxRow = $ws.UsedRange.Rows.Count
    $maxCol = 80
    $hr = Find-HeaderRow $ws $maxRow $maxCol $year $defaultMonth
    $cnt = 0
    if ($hr -ge 2) {
        $tr = $hr - 1
        for ($c = 3; $c -le $maxCol; $c++) {
            $dt = Get-DateFromCell (Get-CellText $ws $hr $c) $year $defaultMonth
            if (-not $dt) { continue }
            $amt = Get-Num (Get-CellText $ws $tr $c)
            if ($amt -le 0) { $amt = Get-Num (Get-CellText $ws $tr ($c+1)) }
            if ($amt -gt 0) { $cnt++ }
        }
    }
    Write-Output ("Sheet $idx $($ws.Name) headerRow=$hr count=$cnt")
    $total += $cnt
}
Write-Output "TOTAL=$total"
$wb.Close($false); $excel.Quit()
