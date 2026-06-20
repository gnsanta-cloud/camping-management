# Google Sheets sync auto setup
# Run: setup-google-sheets.cmd

param(
    [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$GasDir = Join-Path $Root "google-apps-script"
$Clasp = Join-Path $Root "node_modules\.bin\clasp.cmd"
$LocalConfig = Join-Path $Root ".sheets-sync.local.json"
$CodeGs = Join-Path $GasDir "Code.gs"
$SourceGs = Join-Path $GasDir "camping-sync.gs"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

function New-SyncToken {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace("+", "x").Replace("/", "y").Replace("=", "")[0..31] -join ""
}

function Update-SyncTokenInScript($token) {
    Copy-Item $SourceGs $CodeGs -Force
    $text = Get-Content $CodeGs -Raw -Encoding UTF8
    $text = $text -replace 'const SYNC_TOKEN = ".*?";', "const SYNC_TOKEN = `"$token`";"
    Set-Content $CodeGs $text -Encoding UTF8 -NoNewline
}

Set-Location $Root

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Google Sheets Sync Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if (-not (Test-Path $Clasp)) {
    Write-Host "Installing clasp..." -ForegroundColor Yellow
    npm install @google/clasp --save-dev
}

if (-not (Test-Path $CodeGs)) {
    Copy-Item $SourceGs $CodeGs -Force
}

$token = New-SyncToken
Update-SyncTokenInScript $token
Write-Step 1 "Sync token generated"

if (-not $SkipLogin) {
    Write-Step 2 "Google login (browser approval required once)"
    Write-Host "Browser opens automatically. Click Allow / Continue." -ForegroundColor Yellow
    & $Clasp login
}

Write-Step 3 "Create spreadsheet and Apps Script project"
Set-Location $GasDir

$claspJson = Join-Path $GasDir ".clasp.json"
if (-not (Test-Path $claspJson)) {
    & $Clasp create --type sheets --title "CampingSync" --rootDir .
    if ($LASTEXITCODE -ne 0) { throw "clasp create failed" }
}

Write-Step 4 "Upload script"
& $Clasp push --force
if ($LASTEXITCODE -ne 0) { throw "clasp push failed" }

Write-Step 5 "Deploy web app"
$deployOut = & $Clasp deploy --description "camping-sync" 2>&1 | Out-String
Write-Host $deployOut

$deploymentId = $null
if ($deployOut -match '(AKfyc[a-zA-Z0-9_\-]+)') {
    $deploymentId = $Matches[1]
}

if (-not $deploymentId) {
    $deployments = & $Clasp deployments 2>&1
    foreach ($line in $deployments) {
        if ($line -match '(AKfyc[a-zA-Z0-9_\-]+)') {
            $deploymentId = $Matches[1]
            break
        }
    }
}

if (-not $deploymentId) {
    throw "Could not find deployment ID. Run: clasp deployments"
}

$webAppUrl = "https://script.google.com/macros/s/$deploymentId/exec"

$config = @{
    webAppUrl = $webAppUrl
    syncToken = $token
    createdAt = (Get-Date).ToString("o")
}
$config | ConvertTo-Json | Set-Content $LocalConfig -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Web App URL:" -ForegroundColor Yellow
Write-Host "  $webAppUrl"
Write-Host ""
Write-Host "Sync Token:" -ForegroundColor Yellow
Write-Host "  $token"
Write-Host ""
Write-Host "Next: paste into app Settings - Google Sheets sync - Connect" -ForegroundColor Cyan
Write-Host "  https://gnsanta-cloud.github.io/camping-management/" -ForegroundColor Gray
Write-Host ""

try {
    Set-Clipboard -Value "URL: $webAppUrl`nToken: $token"
    Write-Host "Copied URL and token to clipboard." -ForegroundColor Green
} catch { }

Start-Process "https://gnsanta-cloud.github.io/camping-management/"

Set-Location $Root
