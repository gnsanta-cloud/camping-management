$j = Get-Content "d:\Camping\js\excel-catalog.json" -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output "=== categories array ==="
$j.categories
Write-Output "=== product groups ==="
$j.products | Group-Object category | Sort-Object Name | ForEach-Object {
    Write-Output ($_.Name + " : " + $_.Count)
}
