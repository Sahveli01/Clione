# 🔓 Clione

A decentralized digital asset marketplace powered by **Sui Network** and **Walrus Protocol** 🦭

## 🎯 What is Clione?

Clione is a **serverless paywall protocol** that enables creators to sell digital content directly to buyers without intermediaries.

- **Sell**: Upload any file, set a price, get a shareable link
- **Buy**: Connect wallet, pay in SUI, download instantly
- **Earn**: Share affiliate links and earn commission on sales
- **Zero servers**: Everything runs on-chain and client-side

## ✨ Features

- 🦭 **Walrus Storage**: Decentralized file storage on Walrus Protocol
- 🔐 **Client-side encryption**: Files encrypted with AES-256-GCM before upload
- 💸 **Instant payouts**: P2P payments directly to seller's wallet
- 👥 **Affiliate System**: Earn up to 10% commission on referred sales
- 🌐 **Decentralized**: No backend servers, no databases

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Seller      │     │    Affiliate    │     │      Buyer      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
    1. Upload file          Share link             5. Click link
    2. Encrypt (AES-256)    with ?ref=ADDR         6. Connect Wallet
    3. Upload to Walrus 🦭                         7. Pay SUI
    4. Create listing                              8. Decrypt & Download
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Sui Blockchain                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Listing Object (Shared)                                 │   │
│  │  - seller: address                                       │   │
│  │  - price: u64                                            │   │
│  │  - blob_id: String (Walrus Blob ID)                      │   │
│  │  - affiliate_percentage: u64 (basis points, max 1000)    │   │
│  │  - name, description, is_active                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Walrus Protocol 🦭                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Encrypted Blob Storage                                  │   │
│  │  - Decentralized storage grid                            │   │
│  │  - Erasure coding for reliability                        │   │
│  │  - Content-addressed by Blob ID                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Sui CLI
- A Sui wallet (for selling)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/clione.git
cd clione

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet

# Smart Contract Package ID (deploy new contract after changes)
NEXT_PUBLIC_MARKET_PACKAGE_ID=0x...

# Walrus Protocol
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Optional: Google OAuth (for zkLogin)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
```

## 🚢 Deployment & Testing

### Automated Deployment

We provide deployment scripts for both Unix and Windows:

**Unix/Linux/macOS:**
```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

**Windows (PowerShell):**
```powershell
# Run PowerShell script
.\deploy.ps1
```

The scripts will:
1. Check your Sui CLI configuration
2. Build the Move package
3. Publish to the network
4. Save output to `deploy-output.json`
5. Save errors/warnings to `deploy-errors.log` (if any)

### Manual Deployment

```bash
cd contracts/sui_drop
sui move build
sui client publish --gas-budget 100000000 --skip-dependency-verification
```

### Finding Package ID

After deployment, find your Package ID:

**With jq installed:**
```bash
jq -r '.objectChanges[] | select(.type == "published") | .packageId' deploy-output.json
```

**Manual inspection:**
Look for `"type": "published"` in `deploy-output.json`, the `packageId` field is your Package ID.

### Update Environment

```bash
# Update .env.local with your new Package ID
NEXT_PUBLIC_MARKET_PACKAGE_ID=0xYOUR_NEW_PACKAGE_ID
```

### E2E Verification Script

We provide a TypeScript script to verify the Affiliate Split logic works correctly:

```bash
# 1. Update the script with your values
#    Edit scripts/verify-logic.ts:
#    - PACKAGE_ID (from deployment)
#    - SELLER_PRIVATE_KEY
#    - BUYER_PRIVATE_KEY  
#    - AFFILIATE_PRIVATE_KEY

# 2. Run verification
npx tsx scripts/verify-logic.ts
```

**What it tests:**
1. Seller creates a listing with 10% affiliate
2. Buyer purchases using Affiliate's referral link
3. Verifies 90% goes to Seller, 10% to Affiliate

**Expected output:**
```
✅ VERIFICATION PASSED!
   Affiliate received correct commission.
```

### Getting Testnet SUI

Fund your test wallets from the faucet:
- https://faucet.sui.io/
- Discord: `!faucet <address>` in #testnet-faucet

## 📁 Project Structure

```
clione/
├── app/
│   ├── page.tsx              # Landing page
│   ├── generate/             # Sell page (create listings)
│   ├── claim/                # Buy page (purchase & download)
│   └── providers.tsx         # Sui/React Query providers
├── contracts/
│   └── sui_drop/
│       └── sources/
│           └── market.move   # Smart contract
├── lib/
│   ├── walrus-utils.ts       # Walrus Protocol upload/download
│   ├── crypto-utils.ts       # AES-GCM encryption
│   ├── sui-utils.ts          # Sui SDK helpers
│   └── auth.ts               # OAuth helpers
└── hooks/
    └── useZkLogin.ts         # zkLogin React hook
```

## 👥 Affiliate System

Sellers can enable affiliate commissions (up to 10%) on their listings:

1. **Seller** creates listing with `affiliate_percentage` (e.g., 1000 = 10%)
2. **Affiliate** shares link with `?ref=THEIR_ADDRESS`
3. **Buyer** clicks affiliate link and purchases
4. **Smart Contract** automatically splits payment:
   - 90% to Seller
   - 10% to Affiliate

### URL Format

```
# Standard link (no affiliate)
https://clione.app/claim?id=0x123...#encryptionKey

# Affiliate link
https://clione.app/claim?id=0x123...&ref=0xAFFILIATE...#encryptionKey
```

## 🦭 Walrus Integration

### Upload Flow
```typescript
import { uploadToWalrus } from '@/lib/walrus-utils';

// Encrypt file first
const encryptedBlob = await encryptFile(file, key);

// Upload to Walrus (stores for 5 epochs by default)
const blobId = await uploadToWalrus(encryptedBlob, 5);
```

### Download Flow
```typescript
import { downloadFromWalrus } from '@/lib/walrus-utils';

// Download from Walrus
const encryptedData = await downloadFromWalrus(blobId);

// Decrypt
const decryptedFile = await decryptFile(encryptedData, key, iv);
```

## 🔒 Security

- **Encryption key never on-chain**: The decryption key is embedded in the URL fragment (#), which is never sent to servers
- **Client-side encryption**: Files are encrypted in the browser before upload
- **P2P payments**: No funds held by the platform
- **Walrus reliability**: Erasure coding ensures data availability

## 📖 Smart Contract

### Listing Struct

```move
public struct Listing has key, store {
    id: UID,
    seller: address,
    price: u64,
    blob_id: vector<u8>,        // Walrus Blob ID
    name: vector<u8>,
    description: vector<u8>,
    is_active: bool,
    affiliate_percentage: u64,  // Basis points (1000 = 10%)
}
```

### Functions

| Function | Description |
|----------|-------------|
| `create_listing` | Create a new listing (no affiliate) |
| `create_listing_with_affiliate` | Create listing with affiliate % |
| `purchase` | Purchase a listing, payment to seller |
| `purchase_with_referral` | Purchase with affiliate split |
| `deactivate_listing` | Seller deactivates their listing |
| `update_affiliate_percentage` | Update affiliate % |

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, TypeScript
- **Blockchain**: Sui Network, Move
- **Storage**: Walrus Protocol 🦭
- **Encryption**: Web Crypto API (AES-256-GCM)
- **SDK**: @mysten/sui.js, @mysten/dapp-kit

## 📜 License

MIT

## 🙏 Acknowledgments

- Sui Foundation
- Mysten Labs (Walrus Protocol)
- Walrus Team
