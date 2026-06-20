$xlsxPath = "d:\Camping\source.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)

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
    return $null
}

$idx = 0
foreach ($ws in $wb.Worksheets) {
    $idx++
    if ($idx -le 2) { continue }
    if ($idx -gt 5) { break }
    Write-Output "--- Sheet $idx : $($ws.Name) ---"
    $year = 2025; $mo = $null
    if ($ws.Name -match "(\d{1,2})") { $mo = [int]$Matches[1]; if ($mo -ge 6) { $year = 2024 } }
    for ($r = 1; $r -le 5; $r++) {
        for ($c = 3; $c -le 8; $c++) {
            $t = Get-CellText $ws $r $c
            $dt = Get-DateFromCell $t $year $mo
            if ($t) { Write-Output ("  r${r}c${c}='$t' date=$dt") }
        }
    }
}
$wb.Close($false)
$excel.Quit()
