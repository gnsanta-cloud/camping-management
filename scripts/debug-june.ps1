$ErrorActionPreference = "Continue"
$xlsxPath = "d:\Camping\source.xlsx"
$targetSheet = 14

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

function Get-DateFromCell($txt, $year, $defaultMonth) {
    if ([string]::IsNullOrWhiteSpace($txt) -or $txt -eq "-") { return $null }
    $numOnly = ($txt -replace "[^0-9]", "")
    if ($txt -match "^[\d,.\s]+$" -and $numOnly.Length -ge 4) { return $null }

    if ($txt -match "(\d{1,2}).*?(\d{1,2})") {
        $m = [int]$Matches[1]; $d = [int]$Matches[2]
        if ($m -ge 1 -and $m -le 12 -and $d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $m, $d)
        }
    }
    if ($defaultMonth -and $txt -notmatch "," -and $txt.Length -le 8 -and $txt -match "^(\d{1,2})") {
        $d = [int]$Matches[1]
        if ($d -ge 1 -and $d -le 31) {
            return ("{0:D4}-{1:D2}-{2:D2}" -f $year, $defaultMonth, $d)
        }
    }
    return $null
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Worksheets.Item($targetSheet)
$sn = $ws.Name
Write-Output "Sheet name: $sn"

$year = 2025
$defaultMonth = 6
if ($sn -match "(\d{1,2})") { $defaultMonth = [int]$Matches[1] }

for ($r = 1; $r -le 5; $r++) {
    $parts = @()
    for ($c = 1; $c -le 12; $c++) {
        $parts += ("C{0}='{1}'" -f $c, (Get-CellText $ws $r $c))
    }
    Write-Output ("R{0}: {1}" -f $r, ($parts -join " | "))
}

Write-Output "--- Parsed totals (year=$year month=$defaultMonth) ---"
for ($c = 3; $c -le 12; $c++) {
    $hdr = Get-CellText $ws 2 $c
    $tot = Get-CellText $ws 1 $c
    $dt = Get-DateFromCell $hdr $year $defaultMonth
    if ($dt) {
        Write-Output ("col={0} date={1} header='{2}' total='{3}' num={4}" -f $c, $dt, $hdr, $tot, (Get-Num $tot))
    }
}

$wb.Close($false)
$excel.Quit()
