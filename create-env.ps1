# Create .env file for server
Write-Host "Creating server .env file..." -ForegroundColor Yellow

$envPath = "server\.env"
$templatePath = "server\ENV_SETUP.txt"

if (Test-Path $envPath) {
    Write-Host "⚠ server\.env already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Skipping .env creation" -ForegroundColor Gray
        exit 0
    }
}

Write-Host "`n📋 Please provide the following information:" -ForegroundColor Cyan

# Get DATABASE_URL
Write-Host "`n1. DATABASE_URL from Replit:" -ForegroundColor Yellow
Write-Host "   - Go to your Replit project" -ForegroundColor Gray
Write-Host "   - Click Tools → Secrets (🔒 icon)" -ForegroundColor Gray
Write-Host "   - Copy the DATABASE_URL value" -ForegroundColor Gray
$databaseUrl = Read-Host "`nPaste DATABASE_URL here"

# Generate SESSION_SECRET
Write-Host "`n2. Generating SESSION_SECRET..." -ForegroundColor Yellow
$sessionSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>$null
if (-not $sessionSecret) {
    Write-Host "⚠ Could not generate SESSION_SECRET automatically" -ForegroundColor Yellow
    $sessionSecret = Read-Host "Please enter a random secret (32+ characters)"
}

# Create .env file
$envContent = @"
DATABASE_URL=$databaseUrl
SESSION_SECRET=$sessionSecret
NODE_ENV=development
PORT=5000
"@

$envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline

Write-Host "`n✅ Created server\.env file!" -ForegroundColor Green
Write-Host "`nYou can now run: cd server && npm run dev" -ForegroundColor Cyan

