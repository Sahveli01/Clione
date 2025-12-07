# 🚨 CRITICAL: Deployment Synchronization Fix

## Problem
The frontend is calling `create_listing_with_affiliate` but the Sui network reports "No function was found". This indicates the Package ID points to an **old contract deployment** that doesn't include the affiliate logic.

## Solution: Re-Deploy Contract & Update Package ID

### Step 1: Verify Contract Functions (✅ Already Correct)

The Move contract (`contracts/sui_drop/sources/market.move`) contains:
- ✅ `create_listing` (line 58)
- ✅ `create_listing_with_affiliate` (line 70)

**Status:** Contract code is correct. The issue is deployment synchronization.

---

### Step 2: Re-Deploy the Contract

#### Option A: Using Deployment Script (Recommended)

**For Linux/macOS:**
```bash
# Make script executable (if not already)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

**For Windows (PowerShell):**
```powershell
# Run deployment script
.\deploy.ps1
```

#### Option B: Manual Deployment

```bash
# Navigate to contract directory
cd contracts/sui_drop

# Build the contract
sui move build

# Publish to Sui Testnet
sui client publish --gas-budget 100000000 --skip-dependency-verification

# Note the Package ID from the output
# Look for: "packageId": "0x..."
```

**Expected Output:**
```json
{
  "objectChanges": [
    {
      "type": "published",
      "packageId": "0xNEW_PACKAGE_ID_HERE",
      ...
    }
  ]
}
```

---

### Step 3: Update Package ID in Environment

1. **Locate/Create `.env.local` file** in the project root:
   ```bash
   # If file doesn't exist, create it
   touch .env.local  # Linux/macOS
   # or create manually on Windows
   ```

2. **Add/Update the Package ID:**
   ```env
   NEXT_PUBLIC_MARKET_PACKAGE_ID=0xNEW_PACKAGE_ID_HERE
   ```
   
   **Replace `0xNEW_PACKAGE_ID_HERE`** with the actual Package ID from Step 2.

3. **Example:**
   ```env
   NEXT_PUBLIC_MARKET_PACKAGE_ID=0x7b2cc638645ff06da257723482f426658a15b18e310d53f5db3cf342323a8b8a
   ```

---

### Step 4: Restart Development Server

**Stop the current server** (Ctrl+C) and restart:

```bash
npm run dev
```

Or if using a different command:
```bash
yarn dev
# or
pnpm dev
```

---

### Step 5: Verify Deployment

1. **Test the application:**
   - Navigate to `/generate`
   - Create a listing with affiliate enabled
   - Verify no "function not found" errors

2. **Check console logs:**
   - Should see: `📝 Using create_listing_with_affiliate with X basis points`
   - Or: `📝 Using create_listing (no affiliate)`

3. **Verify on Sui Explorer:**
   - Visit: `https://suiscan.xyz/testnet/object/YOUR_PACKAGE_ID`
   - Confirm the package contains both functions

---

## Troubleshooting

### Error: "Package ID not configured"
- **Fix:** Ensure `.env.local` exists and contains `NEXT_PUBLIC_MARKET_PACKAGE_ID`

### Error: "No function was found"
- **Fix:** Package ID is outdated. Re-deploy and update (Steps 2-4)

### Error: "Insufficient gas"
- **Fix:** Ensure your wallet has testnet SUI:
  ```bash
  sui client gas
  # If empty, get testnet SUI from faucet
  ```

### Error: "Build failed"
- **Fix:** Check Move contract syntax:
  ```bash
  cd contracts/sui_drop
  sui move build
  ```

---

## Quick Reference

| Step | Command | Expected Result |
|------|---------|----------------|
| Build | `sui move build` | ✅ Build successful |
| Deploy | `sui client publish --gas-budget 100000000` | Package ID in output |
| Update | Edit `.env.local` | `NEXT_PUBLIC_MARKET_PACKAGE_ID=0x...` |
| Restart | `npm run dev` | Server reloads with new Package ID |

---

## Frontend Defensive Coding

The frontend now includes:
- ✅ Package ID validation before transaction
- ✅ Enhanced error messages for function not found
- ✅ Automatic function selection based on affiliate toggle
- ✅ Console logging for debugging

**Function Selection Logic:**
- **Affiliate OFF:** Uses `create_listing`
- **Affiliate ON:** Uses `create_listing_with_affiliate`

---

## Support

If issues persist:
1. Check `deploy-output.json` for deployment details
2. Verify Package ID on Sui Explorer
3. Check browser console for detailed error messages
4. Ensure Sui CLI is on testnet: `sui client active-env`

