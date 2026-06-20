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

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)

foreach ($idx in @(3, 14)) {
    $ws = $wb.Worksheets.Item($idx)
    Write-Output "=== Sheet $idx : $($ws.Name) ==="
    for ($r = 1; $r -le 4; $r++) {
        $parts = @()
        for ($c = 1; $c -le 14; $c++) {
            $parts += ("C{0}='{1}'" -f $c, (Get-CellText $ws $r $c))
        }
        Write-Output ("R{0}: {1}" -f $r, ($parts -join " | "))
    }
}

$wb.Close($false)
$excel.Quit()
