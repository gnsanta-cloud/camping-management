$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open("d:\Camping\source.xlsx")
$i = 0
foreach ($ws in $wb.Worksheets) {
    $i++
    Write-Output ("{0}: {1}" -f $i, $ws.Name)
}
$wb.Close($false)
$excel.Quit()
