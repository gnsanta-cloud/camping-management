$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Camping = Split-Path -Parent $Root
$Web = Join-Path $Root "web"

if (Test-Path $Web) { Remove-Item $Web -Recurse -Force }
New-Item -ItemType Directory -Path $Web | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Web "css") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Web "js") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Web "icons") | Out-Null

Copy-Item (Join-Path $Root "index.html") (Join-Path $Web "index.html")
Copy-Item (Join-Path $Root "css\mobile.css") (Join-Path $Web "css\mobile.css")
Copy-Item (Join-Path $Camping "css\app.css") (Join-Path $Web "css\app.css")
Copy-Item (Join-Path $Root "js\mobile-app.js") (Join-Path $Web "js\mobile-app.js")

$jsFiles = @("config.js", "storage.js", "reservations.js", "firebase-config.js", "firebase-sync.js")
foreach ($f in $jsFiles) {
    Copy-Item (Join-Path $Camping "js\$f") (Join-Path $Web "js\$f")
}

Copy-Item (Join-Path $Camping "icons\*") (Join-Path $Web "icons\") -Recurse

Write-Host "Web assets synced to mobile-sites/web" -ForegroundColor Green
