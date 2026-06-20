$xlsxPath = (Get-ChildItem "d:\Camping\*.xlsx" | Select-Object -First 1).FullName
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)

$skip = @("가격검색", "합계", "카테고리", "현금매출", "etc")
$cats = @{}
$idx = 0
foreach ($ws in $wb.Worksheets) {
    $idx++
    if ($idx -le 2) { continue }
    $maxRow = [Math]::Min($ws.UsedRange.Rows.Count, 60)
    for ($r = 1; $r -le $maxRow; $r++) {
        $c1 = $ws.Cells.Item($r, 1).Text.Trim()
        $c2 = $ws.Cells.Item($r, 2).Text.Trim()
        if ($c1 -and -not $c2) {
            if ($skip -contains $c1) { continue }
            if ($c1 -match "^\d") { continue }
            if (-not $cats.ContainsKey($c1)) { $cats[$c1] = @() }
            if ($cats[$c1] -notcontains $ws.Name) { $cats[$c1] += $ws.Name }
        }
    }
}

Write-Output "=== SALES SHEET CATEGORIES ==="
$cats.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Output ($_.Name + " (sheets: " + ($_.Value -join ", ") + ")")
}

$wb.Close($false)
$excel.Quit()
