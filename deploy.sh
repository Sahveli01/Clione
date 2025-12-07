#!/bin/bash

# ============================================
# Sui-Unlock Deployment Script
# ============================================
# This script automates the deployment of the sui_drop Move package
# to Sui Testnet.
#
# Prerequisites:
#   - Sui CLI installed and configured
#   - Active Sui wallet with testnet SUI for gas
#   - jq installed (optional, for parsing JSON output)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# After deployment:
#   - Check deploy-output.json for the Package ID
#   - Update .env.local with NEXT_PUBLIC_MARKET_PACKAGE_ID
# ============================================

set -e  # Exit on error

echo "🚀 Sui-Unlock Deployment Script"
echo "================================"
echo ""

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Error: Sui CLI is not installed"
    echo "   Install from: https://docs.sui.io/build/install"
    exit 1
fi

# Check current network
echo "📡 Checking Sui CLI configuration..."
ACTIVE_ENV=$(sui client active-env 2>/dev/null || echo "unknown")
echo "   Active environment: $ACTIVE_ENV"

if [[ "$ACTIVE_ENV" != "testnet" ]]; then
    echo "⚠️  Warning: Not on testnet! Current env: $ACTIVE_ENV"
    echo "   To switch: sui client switch --env testnet"
    read -p "   Continue anyway? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "   Aborted."
        exit 1
    fi
fi

# Show active address
ACTIVE_ADDRESS=$(sui client active-address 2>/dev/null || echo "unknown")
echo "   Active address: $ACTIVE_ADDRESS"
echo ""

# Navigate to contract directory
echo "📁 Navigating to contracts/sui_drop..."
cd contracts/sui_drop

# Build the contract
echo ""
echo "🔨 Building Move package..."
echo "   Running: sui move build"
echo ""

if sui move build; then
    echo ""
    echo "✅ Build successful!"
else
    echo ""
    echo "❌ Build failed! Please fix the errors above."
    exit 1
fi

# Publish the contract
echo ""
echo "📤 Publishing to Sui Network..."
echo "   Running: sui client publish --gas-budget 100000000 --skip-dependency-verification"
echo ""

# Run publish and capture output
# Redirect stderr to separate file to avoid mixing warnings with JSON
if sui client publish --gas-budget 100000000 --skip-dependency-verification --json > ../../deploy-output.json 2>../../deploy-errors.log; then
    echo ""
    echo "✅ Deployment successful!"
    # Clean up error log if empty
    if [ ! -s ../../deploy-errors.log ]; then
        rm -f ../../deploy-errors.log
    else
        echo "   ⚠️  Warnings/errors saved to deploy-errors.log"
    fi
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "   JSON output (may be empty):"
    cat ../../deploy-output.json 2>/dev/null || echo "   (no JSON output)"
    echo ""
    echo "   Errors/warnings:"
    cat ../../deploy-errors.log 2>/dev/null || echo "   (no error log)"
    exit 1
fi

# Return to root
cd ../..

echo ""
echo "================================"
echo "📄 Output saved to: deploy-output.json"
echo ""

# Try to extract Package ID using jq (if available)
if command -v jq &> /dev/null; then
    PACKAGE_ID=$(jq -r '.objectChanges[] | select(.type == "published") | .packageId' deploy-output.json 2>/dev/null)
    
    if [[ -n "$PACKAGE_ID" && "$PACKAGE_ID" != "null" ]]; then
        echo "🎉 Package ID: $PACKAGE_ID"
        echo ""
        echo "📝 Next steps:"
        echo "   1. Copy the Package ID above"
        echo "   2. Update .env.local:"
        echo "      NEXT_PUBLIC_MARKET_PACKAGE_ID=$PACKAGE_ID"
        echo "   3. Restart your dev server"
        echo "   4. Run verification: npx ts-node scripts/verify-logic.ts"
    else
        echo "⚠️  Could not extract Package ID automatically."
        echo "   Please check deploy-output.json manually."
    fi
else
    echo "💡 Tip: Install 'jq' to auto-extract Package ID"
    echo "   brew install jq  (macOS)"
    echo "   apt install jq   (Ubuntu)"
    echo ""
    echo "📖 Manual extraction:"
    echo '   Look for "type": "published" in deploy-output.json'
    echo '   The "packageId" field contains your Package ID'
fi

echo ""
echo "🦭 Happy deploying!"

