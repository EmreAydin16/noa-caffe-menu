# GitHub'a yukle -> Render otomatik deploy eder
# Git kurulu olmali: https://git-scm.com/download/win

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git bulunamadi. Once Git kurun: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path .git)) {
    git init
    git branch -M main
    git remote add origin https://github.com/EmreAydin16/noa-caffe-menu.git
}

git add server.js render.yaml public/ .gitignore package.json scripts/
git status
git commit -m "Performans: logo.svg, onbellek, gzip, ping - bant tasarrufu" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Commit atlandi (degisiklik yok veya zaten commitli)" }
git push -u origin main
Write-Host "Push tamam. Render 2-3 dk icinde gunceller." -ForegroundColor Green
