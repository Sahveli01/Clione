# ============================================
# Sui-Unlock Deployment Script (Temp Directory)
# ============================================
# This script deploys from a temporary directory to avoid permission issues
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Sui-Unlock Deployment (Temp Directory Method)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Get original project path
$originalPath = Get-Location
Write-Host "[INFO] Original path: $originalPath" -ForegroundColor Gray

# Create temporary directory
$tempDir = "$env:TEMP\sui-deploy-$(Get-Random)"
Write-Host "[INFO] Creating temp directory: $tempDir" -ForegroundColor Cyan

try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Copy contracts directory
    Write-Host "[INFO] Copying contracts to temp directory..." -ForegroundColor Cyan
    Copy-Item -Path "$originalPath\contracts\sui_drop" -Destination "$tempDir\sui_drop" -Recurse -Force
    
    # Navigate to temp directory
    Push-Location "$tempDir\sui_drop"
    
    # Build
    Write-Host ""
    Write-Host "[INFO] Building Move package..." -ForegroundColor Cyan
    sui move build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed!" -ForegroundColor Red
        Pop-Location
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    
    Write-Host "[SUCCESS] Build successful!" -ForegroundColor Green
    
    # Publish
    Write-Host ""
    Write-Host "[INFO] Publishing to Sui Network..." -ForegroundColor Cyan
    Write-Host "   This may take a minute..." -ForegroundColor Gray
    
    # Set temp directory for Sui CLI to avoid permission issues
    $originalTemp = $env:TEMP
    $env:TEMP = $tempDir
    
    try {
        # Publish and save output
        $publishOutput = sui client publish --gas-budget 100000000 --skip-dependency-verification --json 2>&1
    } finally {
        # Restore original temp
        $env:TEMP = $originalTemp
    }
    
    # Save to original directory
    $outputFile = "$originalPath\deploy-output.json"
    $publishOutput | Out-File -FilePath $outputFile -Encoding utf8
    
    # Also save errors separately
    $errorFile = "$originalPath\deploy-errors.log"
    $publishOutput | Where-Object { $_ -match "warning|error" } | Out-File -FilePath $errorFile -Encoding utf8 -ErrorAction SilentlyContinue
    
    Write-Host "[SUCCESS] Deployment output saved!" -ForegroundColor Green
    Write-Host "   Output: $outputFile" -ForegroundColor Gray
    
} catch {
    Write-Host "[ERROR] Deployment failed: $_" -ForegroundColor Red
    Pop-Location
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
} finally {
    Pop-Location
    # Cleanup
    Write-Host "[INFO] Cleaning up temp directory..." -ForegroundColor Gray
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "[INFO] Extracting Package ID..." -ForegroundColor Cyan

# Extract Package ID
if (Test-Path "$originalPath\deploy-output.json") {
    try {
        $content = Get-Content "$originalPath\deploy-output.json" -Raw
        $firstBrace = $content.IndexOf('{')
        $lastBrace = $content.LastIndexOf('}')
        
        if ($firstBrace -ge 0 -and $lastBrace -gt $firstBrace) {
            $jsonString = $content.Substring($firstBrace, $lastBrace - $firstBrace + 1)
            $json = $jsonString | ConvertFrom-Json
            
            $packageId = $null
            if ($json.objectChanges) {
                $published = $json.objectChanges | Where-Object { $_.type -eq "published" }
                if ($published -and $published.packageId) {
                    $packageId = $published.packageId
                }
            }
            
            if ($packageId) {
                Write-Host ""
                Write-Host "[SUCCESS] Package ID: $packageId" -ForegroundColor Green
                Write-Host ""
                Write-Host "[INFO] Next steps:" -ForegroundColor Cyan
                Write-Host "   1. Run: npm run post-deploy" -ForegroundColor Yellow
                Write-Host "   2. Package ID will be auto-updated in .env.local" -ForegroundColor Yellow
            } else {
                Write-Host "[WARNING] Could not extract Package ID automatically" -ForegroundColor Yellow
                Write-Host "   Check deploy-output.json manually" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "[WARNING] Could not parse JSON: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
Write-Host ""

