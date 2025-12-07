# ============================================
# Clean Deployment Script
# ============================================
# Removes lock files and deploys from temp directory
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Sui-Unlock Clean Deployment" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

$originalPath = Get-Location

# Step 1: Remove lock files
Write-Host "[INFO] Cleaning lock files..." -ForegroundColor Cyan
$lockFiles = @(
    "$originalPath\contracts\sui_drop\Move.lock",
    "$originalPath\contracts\sui_drop\build"
)

foreach ($file in $lockFiles) {
    if (Test-Path $file) {
        try {
            Remove-Item -Path $file -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "   Removed: $file" -ForegroundColor Gray
        } catch {
            Write-Host "   Could not remove: $file" -ForegroundColor Yellow
        }
    }
}

# Step 2: Create temp directory
$tempDir = "$env:TEMP\sui-deploy-$(Get-Random)"
Write-Host "[INFO] Creating temp directory..." -ForegroundColor Cyan

try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Copy contracts
    Write-Host "[INFO] Copying contracts..." -ForegroundColor Cyan
    Copy-Item -Path "$originalPath\contracts\sui_drop" -Destination "$tempDir\sui_drop" -Recurse -Force
    
    # Remove lock file from temp copy too
    $tempLock = "$tempDir\sui_drop\Move.lock"
    if (Test-Path $tempLock) {
        Remove-Item -Path $tempLock -Force -ErrorAction SilentlyContinue
    }
    
    Push-Location "$tempDir\sui_drop"
    
    # Build
    Write-Host ""
    Write-Host "[INFO] Building..." -ForegroundColor Cyan
    sui move build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    Write-Host "[SUCCESS] Build OK" -ForegroundColor Green
    
    # Publish with custom temp
    Write-Host ""
    Write-Host "[INFO] Publishing (this may take 1-2 minutes)..." -ForegroundColor Cyan
    
    # Change to a writable temp location
    $oldTemp = $env:TEMP
    $oldTmp = $env:TMP
    $env:TEMP = $tempDir
    $env:TMP = $tempDir
    
    try {
        # Run publish and capture ALL output
        $publishProcess = Start-Process -FilePath "sui" `
            -ArgumentList "client", "publish", "--gas-budget", "100000000", "--skip-dependency-verification", "--json" `
            -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput "$originalPath\deploy-output.json" `
            -RedirectStandardError "$originalPath\deploy-errors.log"
        
        $exitCode = $publishProcess.ExitCode
        
    } finally {
        $env:TEMP = $oldTemp
        $env:TMP = $oldTmp
    }
    
    Pop-Location
    
    if ($exitCode -eq 0) {
        Write-Host "[SUCCESS] Deployment completed!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Exit code: $exitCode (may still have Package ID)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "[ERROR] Failed: $_" -ForegroundColor Red
    Pop-Location
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
} finally {
    if ((Get-Location).Path -ne $originalPath) {
        Pop-Location
    }
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Extract Package ID
Write-Host ""
Write-Host "[INFO] Extracting Package ID..." -ForegroundColor Cyan

if (Test-Path "$originalPath\deploy-output.json") {
    $content = Get-Content "$originalPath\deploy-output.json" -Raw -ErrorAction SilentlyContinue
    
    if ($content) {
        $firstBrace = $content.IndexOf('{')
        $lastBrace = $content.LastIndexOf('}')
        
        if ($firstBrace -ge 0 -and $lastBrace -gt $firstBrace) {
            try {
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
                    Write-Host "Next: npm run post-deploy" -ForegroundColor Yellow
                } else {
                    Write-Host "[WARNING] Package ID not found in output" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "[WARNING] Could not parse JSON" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
Write-Host ""

