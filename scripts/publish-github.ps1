# GitHub Pages 배포 스크립트
# 사용법: PowerShell에서 프로젝트 루트 기준 실행
#   cd d:\Camping
#   .\scripts\publish-github.ps1
#   .\scripts\publish-github.ps1 -RepoName "my-camping-app" -Private

param(
    [string]$RepoName = "camping-management",
    [switch]$Private
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Ensure-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "'$name' 이(가) 설치되어 있지 않습니다. Git / GitHub CLI를 먼저 설치하세요."
    }
}

Ensure-Command git
Ensure-Command gh

Write-Host "GitHub 로그인 상태 확인..." -ForegroundColor Cyan
try {
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "not logged in" }
} catch {
    Write-Host "GitHub 로그인이 필요합니다. 브라우저 창이 열리면 승인해 주세요." -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
}

$user = gh api user --jq .login
Write-Host "로그인 계정: $user" -ForegroundColor Green

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

$hasCommit = git rev-parse HEAD 2>$null
if (-not $hasCommit) {
    git add .
    git -c user.name="$user" -c user.email="$user@users.noreply.github.com" commit -m "Add camping management PWA"
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    $visibility = if ($Private) { "--private" } else { "--public" }
    Write-Host "저장소 생성: $user/$RepoName" -ForegroundColor Cyan
    gh repo create $RepoName $visibility --source=. --remote=origin --description "캠핑장 예약·매점 POS·매출 관리 PWA"
}

Write-Host "GitHub에 push..." -ForegroundColor Cyan
git push -u origin main

Write-Host "GitHub Pages 활성화..." -ForegroundColor Cyan
gh api "repos/$user/$RepoName/pages" -X POST -f "build_type=legacy" -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pages API 호출 실패 — GitHub 웹에서 Settings > Pages > main / (root) 로 설정하세요." -ForegroundColor Yellow
}

$pagesUrl = "https://$user.github.io/$RepoName/"
Write-Host ""
Write-Host "완료!" -ForegroundColor Green
Write-Host "Pages URL (1~3분 후 접속): $pagesUrl" -ForegroundColor Green
Write-Host "PWA 설치: 위 주소를 스마트폰 Chrome/Safari에서 열고 '홈 화면에 추가'" -ForegroundColor Cyan
