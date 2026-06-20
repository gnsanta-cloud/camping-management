$ErrorActionPreference = "Stop"
$xlsxPath = (Get-ChildItem "d:\Camping\*.xlsx" | Select-Object -First 1).FullName
$outJson = "d:\Camping\js\excel-catalog.json"
$outJs = "d:\Camping\js\excel-catalog.js"

function Get-Num($val) {
    if ($null -eq $val) { return 0 }
    $s = ($val.ToString() -replace "[^0-9]", "")
    if ($s -eq "") { return 0 }
    return [int]$s
}

function Test-BadCategory($name) {
    if (-not $name -or $name.Length -lt 2) { return $true }
    if ($name -match "^\d") { return $true }
    if ($name.Length -gt 15) { return $true }
    return $false
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsxPath)

$products = @{}
$idx = 0

foreach ($ws in $wb.Worksheets) {
    $idx++
    if ($idx -le 2) { continue }

    $maxRow = $ws.UsedRange.Rows.Count
    $currentCat = ""

    for ($r = 1; $r -le $maxRow; $r++) {
        $c1 = $ws.Cells.Item($r, 1).Text.Trim()
        $c2 = $ws.Cells.Item($r, 2).Text.Trim()
        $c3 = Get-Num $ws.Cells.Item($r, 3).Text

        if ($c1 -and -not $c2) {
            if (-not (Test-BadCategory $c1)) { $currentCat = $c1 }
            continue
        }

        if (-not $c2) { continue }
        if ($c3 -le 0) { continue }
        if ((Get-Num $c2) -gt 0 -and $c3 -eq 0) { continue }

        if ($c1 -and -not (Test-BadCategory $c1)) { $currentCat = $c1 }
        if (-not $currentCat -or (Test-BadCategory $currentCat)) { continue }

        $key = "$currentCat|$c2"
        if (-not $products.ContainsKey($key)) {
            $products[$key] = @{ category = $currentCat; name = $c2; price = $c3; note = "" }
        } else {
            $products[$key].price = $c3
        }
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$productList = @($products.Values | Sort-Object { $_.category }, { $_.name })
$catList = @($productList | ForEach-Object { $_.category } | Select-Object -Unique | Sort-Object)

$result = @{ categories = $catList; products = $productList }
$json = $result | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outJson, $json, (New-Object System.Text.UTF8Encoding $false))
$js = "const EXCEL_CATALOG = " + $json + ";"
[System.IO.File]::WriteAllText($outJs, $js, (New-Object System.Text.UTF8Encoding $false))
Write-Output ("cats=" + $catList.Count + " products=" + $productList.Count)
$catList | ForEach-Object { Write-Output ("  - " + $_) }
