$ErrorActionPreference = "Continue"
$xlsxPath = "d:\Camping\source.xlsx"

function Get-CellText($ws, $r, $c) {
    try {
        $v = $ws.Cells.Item($r, $c).Text
        if ($null -eq $v) { return "" }
        return $v.ToString().Trim()
    } catch { return "" }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Worksheets.Item(14)

Write-Output "Scan sheet 14 cols 1-80 rows 2-3 for dates/totals"
for ($c = 1; $c -le 80; $c++) {
    $tot = Get-CellText $ws 2 $c
    $hdr = Get-CellText $ws 3 $c
    if ($tot -or $hdr) {
        Write-Output ("C{0}: total='{1}' header='{2}'" -f $c, $tot, $hdr)
    }
}

$wb.Close($false)
$excel.Quit()
