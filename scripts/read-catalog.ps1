$xlsxPath = (Get-ChildItem "d:\Camping\*.xlsx" | Select-Object -First 1).FullName
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Worksheets.Item(2)

Write-Output "=== HEADER ==="
for ($r = 1; $r -le 5; $r++) {
    $line = @()
    for ($c = 1; $c -le 4; $c++) { $line += $ws.Cells.Item($r, $c).Text }
    Write-Output ($r.ToString() + ": " + ($line -join " | "))
}

$cats = @{}
$count = 0
for ($r = 2; $r -le $ws.UsedRange.Rows.Count; $r++) {
    $name = $ws.Cells.Item($r, 1).Text.Trim()
    $cat = $ws.Cells.Item($r, 2).Text.Trim()
    if ($name -and $cat) {
        if (-not $cats.ContainsKey($cat)) { $cats[$cat] = 0 }
        $cats[$cat]++
        $count++
    }
}
Write-Output "=== CATEGORIES ($count products) ==="
$cats.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Output ($_.Name + " : " + $_.Value) }

$wb.Close($false)
$excel.Quit()
