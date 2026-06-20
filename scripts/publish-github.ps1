# GitHub Pages deploy script
# Run: publish-github.cmd  (recommended)
# Or:  powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1

param(
    [string]$RepoName = "camping-management",
    [switch]$Private
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Add-ToolPaths {
    $paths = @(
        "$env:ProgramFiles\Git\cmd",
        "$env:ProgramFiles\Git\bin",
        "$env:ProgramFiles\GitHub CLI",
        "$env:LocalAppData\Programs\Git\cmd",
        "$env:LocalAppData\Programs\GitHub CLI"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            $env:Path = "$p;$env:Path"
        }
    }
}

function Require-Command($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host ""
        Write-Host "[ERROR] '$name' command not found in PATH." -ForegroundColor Red
        Write-Host "Install Git / GitHub CLI, then open a NEW terminal and retry." -ForegroundColor Yellow
        Write-Host "  Git: https://git-scm.com/download/win" -ForegroundColor Gray
        Write-Host "  GitHub CLI: https://cli.github.com/" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Or run: publish-github.cmd" -ForegroundColor Cyan
        exit 1
    }
}

Add-ToolPaths
Require-Command git
Require-Command gh

Write-Host "Checking GitHub login..." -ForegroundColor Cyan
$loggedIn = $false
try {
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $loggedIn = $true }
} catch {
    $loggedIn = $false
}

if (-not $loggedIn) {
    Write-Host "GitHub login required. Approve in the browser window." -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
}

$user = gh api user --jq .login
Write-Host "Logged in as: $user" -ForegroundColor Green

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

$hasCommit = $false
try {
    git rev-parse HEAD 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $hasCommit = $true }
} catch {
    $hasCommit = $false
}

if (-not $hasCommit) {
    git add .
    git -c user.name="$user" -c user.email="$user@users.noreply.github.com" commit -m "Add camping management PWA"
}

$remote = $null
if ((git remote 2>$null) -contains "origin") {
    $remote = git remote get-url origin
}
if (-not $remote) {
    $visibility = if ($Private) { "--private" } else { "--public" }
    Write-Host "Creating repository: $user/$RepoName" -ForegroundColor Cyan
    gh repo create $RepoName $visibility --source=. --remote=origin --description "Camping site management PWA"
}

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "Enabling GitHub Pages..." -ForegroundColor Cyan
gh api "repos/$user/$RepoName/pages" -X POST -f "build_type=legacy" -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pages API failed. Set manually: Settings > Pages > main / (root)" -ForegroundColor Yellow
}

$pagesUrl = "https://$user.github.io/$RepoName/"
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "Pages URL (wait 1-3 min): $pagesUrl" -ForegroundColor Green
Write-Host "On phone: open URL in Chrome/Safari > Add to Home Screen" -ForegroundColor Cyan
