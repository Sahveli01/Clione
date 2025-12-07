# ============================================
# Sui-Unlock Deployment Script (PowerShell)
# ============================================
# This script automates the deployment of the sui_drop Move package
# to Sui Testnet on Windows.
#
# Prerequisites:
#   - Sui CLI installed and configured
#   - Active Sui wallet with testnet SUI for gas
#
# Usage:
#   .\deploy.ps1
#
# After deployment:
#   - Check deploy-output.json for the Package ID
#   - Run: npm run post-deploy
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Sui-Unlock Deployment Script (PowerShell)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Sui CLI is installed
try {
    $null = Get-Command sui -ErrorAction Stop
} catch {
    Write-Host "[ERROR] Sui CLI is not installed" -ForegroundColor Red
    Write-Host "   Install from: https://docs.sui.io/build/install" -ForegroundColor Yellow
    exit 1
}

# Check current network
Write-Host "[INFO] Checking Sui CLI configuration..." -ForegroundColor Cyan
$activeEnv = "unknown"
try {
    $envOutput = sui client active-env 2>&1
    if ($envOutput -and $envOutput -notmatch "error" -and $envOutput -notmatch "warning") {
        $activeEnv = $envOutput.ToString().Trim()
        Write-Host "   Active environment: $activeEnv" -ForegroundColor Gray
    } else {
        Write-Host "   Could not determine active environment (will continue)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Could not determine active environment (will continue)" -ForegroundColor Yellow
}

# Only warn if we can confirm it's NOT testnet
if ($activeEnv -ne "unknown" -and $activeEnv -ne "testnet") {
    Write-Host "[WARNING] Not on testnet! Current env: $activeEnv" -ForegroundColor Yellow
    $confirm = Read-Host "   Continue anyway? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "   Aborted." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   Proceeding with deployment..." -ForegroundColor Gray
}

# Show active address
try {
    $activeAddress = sui client active-address 2>$null
    if ($activeAddress) {
        Write-Host "   Active address: $activeAddress" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Could not get active address" -ForegroundColor Yellow
}

Write-Host ""

# Navigate to contract directory
Write-Host "[INFO] Navigating to contracts/sui_drop..." -ForegroundColor Cyan
Push-Location "contracts\sui_drop"

try {
    # Build the contract
    Write-Host ""
    Write-Host "[INFO] Building Move package..." -ForegroundColor Cyan
    Write-Host "   Running: sui move build" -ForegroundColor Gray
    Write-Host ""

    sui move build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Build failed! Please fix the errors above." -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host ""
    Write-Host "[SUCCESS] Build successful!" -ForegroundColor Green

    # Publish the contract
    Write-Host ""
    Write-Host "[INFO] Publishing to Sui Network..." -ForegroundColor Cyan
    Write-Host "   Running: sui client publish --gas-budget 100000000 --skip-dependency-verification" -ForegroundColor Gray
    Write-Host ""

    # Run publish and capture output separately
    try {
        # Capture stdout (JSON) and stderr separately
        $publishProcess = Start-Process -FilePath "sui" `
            -ArgumentList "client", "publish", "--gas-budget", "100000000", "--skip-dependency-verification", "--json" `
            -NoNewWindow -Wait -PassThru -RedirectStandardOutput "..\..\deploy-output.json" `
            -RedirectStandardError "..\..\deploy-errors.log"

        if ($publishProcess.ExitCode -eq 0) {
            Write-Host ""
            Write-Host "[SUCCESS] Deployment successful!" -ForegroundColor Green
            
            # Check if error log has content
            if (Test-Path "..\..\deploy-errors.log") {
                $errorContent = Get-Content "..\..\deploy-errors.log" -Raw
                if ($errorContent -and $errorContent.Trim().Length -gt 0) {
                    Write-Host "   [WARNING] Warnings/errors saved to deploy-errors.log" -ForegroundColor Yellow
                } else {
                    Remove-Item "..\..\deploy-errors.log" -ErrorAction SilentlyContinue
                }
            }
        } else {
            Write-Host ""
            Write-Host "[ERROR] Deployment failed!" -ForegroundColor Red
            Write-Host ""
            Write-Host "   JSON output (may be empty):" -ForegroundColor Yellow
            if (Test-Path "..\..\deploy-output.json") {
                Get-Content "..\..\deploy-output.json" -ErrorAction SilentlyContinue
            } else {
                Write-Host "   (no JSON output)" -ForegroundColor Gray
            }
            Write-Host ""
            Write-Host "   Errors/warnings:" -ForegroundColor Yellow
            if (Test-Path "..\..\deploy-errors.log") {
                Get-Content "..\..\deploy-errors.log" -ErrorAction SilentlyContinue
            } else {
                Write-Host "   (no error log)" -ForegroundColor Gray
            }
            Pop-Location
            exit 1
        }
    } catch {
        Write-Host ""
        Write-Host "[ERROR] Deployment failed with exception!" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "[INFO] Output saved to: deploy-output.json" -ForegroundColor Cyan
Write-Host ""

# Try to extract Package ID using PowerShell
if (Test-Path "deploy-output.json") {
    try {
        $jsonContent = Get-Content "deploy-output.json" -Raw
        # Extract JSON portion
        $firstBrace = $jsonContent.IndexOf('{')
        $lastBrace = $jsonContent.LastIndexOf('}')
        
        if ($firstBrace -ge 0 -and $lastBrace -gt $firstBrace) {
            $jsonString = $jsonContent.Substring($firstBrace, $lastBrace - $firstBrace + 1)
            $json = $jsonString | ConvertFrom-Json
            
            $packageId = $null
            if ($json.objectChanges) {
                $published = $json.objectChanges | Where-Object { $_.type -eq "published" }
                if ($published -and $published.packageId) {
                    $packageId = $published.packageId
                }
            }
            
            if ($packageId) {
                Write-Host "[SUCCESS] Package ID: $packageId" -ForegroundColor Green
                Write-Host ""
                Write-Host "[INFO] Next steps:" -ForegroundColor Cyan
                Write-Host "   1. Run: npm run post-deploy" -ForegroundColor Yellow
                Write-Host "   2. Restart your dev server" -ForegroundColor Yellow
            } else {
                Write-Host "[WARNING] Could not extract Package ID automatically." -ForegroundColor Yellow
                Write-Host "   Please check deploy-output.json manually." -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "[WARNING] Could not parse JSON automatically." -ForegroundColor Yellow
        Write-Host "   Please check deploy-output.json manually." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Happy deploying!" -ForegroundColor Cyan
Write-Host ""
