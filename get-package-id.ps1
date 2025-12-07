# Package ID extraction script
$outputFile = "deploy-output.json"

if (Test-Path $outputFile) {
    $content = Get-Content $outputFile -Raw
    
    # Extract JSON portion
    $firstBrace = $content.IndexOf('{')
    $lastBrace = $content.LastIndexOf('}')
    
    if ($firstBrace -ge 0 -and $lastBrace -gt $firstBrace) {
        $jsonString = $content.Substring($firstBrace, $lastBrace - $firstBrace + 1)
        
        try {
            $json = $jsonString | ConvertFrom-Json
            
            # Find published package
            if ($json.objectChanges) {
                $published = $json.objectChanges | Where-Object { $_.type -eq "published" }
                if ($published -and $published.packageId) {
                    Write-Host "✅ Package ID found: $($published.packageId)" -ForegroundColor Green
                    $published.packageId
                    exit 0
                }
            }
            
            Write-Host "❌ No published package found in output" -ForegroundColor Red
        } catch {
            Write-Host "❌ Failed to parse JSON: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ No valid JSON found in deploy-output.json" -ForegroundColor Red
        Write-Host "   File may contain only errors. Check deploy-errors.log" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ deploy-output.json not found" -ForegroundColor Red
    Write-Host "   Run deployment first: .\deploy.ps1" -ForegroundColor Yellow
}

