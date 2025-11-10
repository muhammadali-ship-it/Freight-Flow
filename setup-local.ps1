# FreightFlow Local Setup Script for Windows
# Run this script with: .\setup-local.ps1

Write-Host "
╔════════════════════════════════════════════╗
║   FreightFlow Local Setup                  ║
║   Setting up client and server...          ║
╚════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "`n[1/5] Checking Node.js installation..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if .env files exist
Write-Host "`n[2/5] Checking environment files..." -ForegroundColor Yellow

$serverEnvExists = Test-Path "server\.env"
$clientEnvExists = Test-Path "client\.env"

if (-not $serverEnvExists) {
    Write-Host "✗ server\.env not found!" -ForegroundColor Red
    Write-Host "Creating from template..." -ForegroundColor Yellow
    Copy-Item "server\ENV_SETUP.txt" "server\.env"
    Write-Host "⚠ IMPORTANT: Edit server\.env and add your DATABASE_URL and SESSION_SECRET" -ForegroundColor Yellow
    Write-Host "`nTo generate SESSION_SECRET, run:" -ForegroundColor Cyan
    Write-Host "node -e `"console.log(require('crypto').randomBytes(32).toString('hex'))`"`n" -ForegroundColor Cyan
} else {
    Write-Host "✓ server\.env exists" -ForegroundColor Green
}

if (-not $clientEnvExists) {
    Write-Host "Creating client\.env..." -ForegroundColor Yellow
    Copy-Item "client\ENV_SETUP.txt" "client\.env"
    Write-Host "✓ client\.env created" -ForegroundColor Green
} else {
    Write-Host "✓ client\.env exists" -ForegroundColor Green
}

# Install server dependencies
Write-Host "`n[3/5] Installing server dependencies..." -ForegroundColor Yellow
Push-Location server
if (Test-Path "package.json") {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Server dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install server dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    Write-Host "✗ server/package.json not found!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Install client dependencies
Write-Host "`n[4/5] Installing client dependencies..." -ForegroundColor Yellow
Push-Location client
if (Test-Path "package.json") {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Client dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install client dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    Write-Host "✗ client/package.json not found!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n[5/5] Setup complete!" -ForegroundColor Green

Write-Host "
╔════════════════════════════════════════════╗
║   Setup Complete!                          ║
╚════════════════════════════════════════════╝

📋 Next Steps:

1. Configure your environment:
   - Edit server\.env and add your DATABASE_URL from Replit
   - Generate and add SESSION_SECRET

2. Push database schema (first time only):
   cd server
   npm run db:push

3. Run the application:
   
   Terminal 1 (Server):
   cd server
   npm run dev
   
   Terminal 2 (Client):
   cd client
   npm run dev

4. Open your browser:
   http://localhost:5173

📚 For detailed instructions, see:
   - README.md
   - SETUP_GUIDE.md

" -ForegroundColor Cyan

if (-not $serverEnvExists) {
    Write-Host "⚠ REMEMBER: You must configure server\.env before running the app!" -ForegroundColor Yellow
}

