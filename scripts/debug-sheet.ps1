$xlsxPath = "d:\Camping\source.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Worksheets.Item(3)
Write-Output "Sheet: $($ws.Name)"
for ($r = 1; $r -le 6; $r++) {
    $line = @()
    for ($c = 1; $c -le 10; $c++) {
        try { $line += $ws.Cells.Item($r,$c).Text } catch { $line += "?" }
    }
    Write-Output ("Row${r}: " + ($line -join " | "))
}
$wb.Close($false)
$excel.Quit()
