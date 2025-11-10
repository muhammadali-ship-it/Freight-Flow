# Quick setup script for server .env file
Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Server .env Setup                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$envPath = "server\.env"

if (Test-Path $envPath) {
    Write-Host "⚠ server\.env already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "`nSkipping. Edit server\.env manually if needed." -ForegroundColor Gray
        exit 0
    }
}

Write-Host "📋 Setup Instructions:" -ForegroundColor Yellow
Write-Host "`n1. Get DATABASE_URL from Replit:" -ForegroundColor Cyan
Write-Host "   - Go to https://replit.com" -ForegroundColor Gray
Write-Host "   - Open your FreightFlow project" -ForegroundColor Gray
Write-Host "   - Click Tools → Secrets (🔒 icon)" -ForegroundColor Gray
Write-Host "   - Copy the DATABASE_URL value`n" -ForegroundColor Gray

$databaseUrl = Read-Host "Paste your DATABASE_URL here"

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Host "`n❌ DATABASE_URL cannot be empty!" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Generating SESSION_SECRET..." -ForegroundColor Cyan
$sessionSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>$null

if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
    Write-Host "⚠ Could not auto-generate SESSION_SECRET" -ForegroundColor Yellow
    $sessionSecret = Read-Host "Please enter a random secret (32+ characters)"
    
    if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
        Write-Host "`n❌ SESSION_SECRET cannot be empty!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Generated SESSION_SECRET" -ForegroundColor Green
}

# Create .env file
$envContent = @"
DATABASE_URL=$databaseUrl
SESSION_SECRET=$sessionSecret
NODE_ENV=development
PORT=5000
"@

try {
    $envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
    Write-Host "`n✅ Created server\.env file successfully!" -ForegroundColor Green
    Write-Host "`n📁 File location: $((Resolve-Path $envPath).Path)" -ForegroundColor Cyan
    Write-Host "`n🚀 You can now run: cd server && npm run dev" -ForegroundColor Green
} catch {
    Write-Host "`n❌ Error creating .env file: $_" -ForegroundColor Red
    exit 1
}

