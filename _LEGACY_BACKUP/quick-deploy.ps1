# Quick deployment script
Push-Location "contracts\sui_drop"
sui client publish --gas-budget 100000000 --skip-dependency-verification --json | Out-File -FilePath "..\..\deploy-output.json" -Encoding utf8
Pop-Location
Write-Host "Deployment complete. Check deploy-output.json"

