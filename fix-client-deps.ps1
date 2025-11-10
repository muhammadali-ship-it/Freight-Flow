# Fix client rollup dependency issue
Write-Host "Fixing client rollup dependencies..." -ForegroundColor Yellow

Push-Location client

Write-Host "Removing node_modules and package-lock.json..." -ForegroundColor Yellow
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue

Write-Host "Reinstalling dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Client dependencies fixed successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to fix dependencies" -ForegroundColor Red
}

Pop-Location

