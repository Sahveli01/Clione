# Sui-Drop Setup Guide

This guide will help you set up and configure the Sui-Drop project.

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Sui wallet with testnet SUI for the relayer
- Google OAuth credentials

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy the example environment file:
```bash
cp .env.example .env.local
```

## Configuration

### 1. Sui Network Configuration

Set the network in `.env.local`:
```env
NEXT_PUBLIC_SUI_NETWORK=testnet
```

Options: `testnet`, `mainnet`, `devnet`

### 2. Relayer Configuration

The relayer is the account that pays for gas fees and gets reimbursed via atomic swaps.

1. Generate a new Sui keypair (or use an existing one):
```bash
# Using Sui CLI
sui client new-address ed25519
```

2. Fund the relayer account with SUI (for testnet, use the faucet)

3. Add to `.env.local`:
```env
RELAYER_PRIVATE_KEY=your_private_key_hex_here
NEXT_PUBLIC_RELAYER_ADDRESS=your_relayer_address_here
```

**Security Note:** Never commit `.env.local` to version control. The relayer private key must be kept secret.

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/oauth/callback` (for dev)
   - Add production URL for production deployment
6. Copy the Client ID and add to `.env.local`:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 4. Cetus Protocol Configuration (Optional)

If you need to update Cetus package addresses, edit `lib/cetus-utils.ts`:
- Update `CETUS_CONFIG` with actual package IDs for your network
- Update `TOKEN_TYPES` with actual token type addresses

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
sui-drop/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── relay/         # Relayer endpoint
│   ├── generate/          # Link generator page
│   ├── claim/             # Claim page
│   └── oauth/             # OAuth callback handler
├── lib/                   # Core utilities
│   ├── zk-utils.ts        # zkLogin utilities
│   ├── sui-utils.ts       # Sui SDK helpers
│   ├── cetus-utils.ts     # Cetus swap logic
│   └── relayer-utils.ts   # Relayer logic
├── hooks/                 # React hooks
│   ├── useZkLogin.ts      # zkLogin hook
│   └── useRelayer.ts      # Relayer hook
└── components/            # React components (if needed)
```

## How It Works

### 1. Link Generation
- Sender enters recipient email and amount
- System generates a random `Master Salt`
- Creates a claim URL with salt in the hash: `suidrop.com/claim#salt=...&email=...&amount=...`

### 2. Claiming Process
- Receiver opens the claim URL
- Logs in with Google (zkLogin)
- System computes their address: `Hash(JWT_Issuer + Email + Master_Salt)`
- Constructs transaction with atomic swap:
  - Swaps portion of token to SUI (for gas reimbursement)
  - Transfers SUI to relayer
  - Transfers remaining tokens to recipient
- Relayer signs and executes the transaction

### 3. Self-Sustaining Relayer
- Relayer pays gas fees upfront
- Gets reimbursed via atomic swap within the same transaction
- No external gas stations needed

## Important Notes

### Current Limitations

1. **Cetus Swap Implementation**: The current swap implementation is a placeholder. You need to:
   - Install and configure `@cetusprotocol/cetus-sui-clmm-sdk`
   - Update `lib/cetus-utils.ts` with actual SDK methods
   - Query pool addresses and current rates

2. **Token Balance Queries**: The current implementation assumes token availability. You should:
   - Query user's token balance before constructing transactions
   - Handle cases where user has insufficient balance
   - Merge coin objects if needed

3. **Gas Estimation**: Current gas estimation is simplified. For production:
   - Use `SUI_CLIENT.dryRunTransactionBlock` for accurate estimates
   - Add proper error handling for estimation failures

4. **zkLogin Proof Generation**: The current implementation handles JWT but doesn't generate zk proofs. You may need to:
   - Integrate with Mysten's zkLogin prover service
   - Generate proofs before submitting transactions

### Security Considerations

- Never expose the relayer private key
- Validate all user inputs
- Implement rate limiting on the relayer endpoint
- Add transaction validation before signing
- Monitor relayer balance and set minimum reserves

## Testing

1. Test on Sui testnet first
2. Use testnet SUI from the faucet
3. Test with small amounts initially
4. Verify atomic swaps work correctly
5. Test error cases (insufficient balance, network errors, etc.)

## Deployment

1. Set production environment variables
2. Update Google OAuth redirect URIs
3. Ensure relayer account is funded
4. Deploy to Vercel, Netlify, or your preferred platform
5. Configure production Sui network endpoints

## Troubleshooting

### "Relayer address not configured"
- Check `NEXT_PUBLIC_RELAYER_ADDRESS` in `.env.local`
- Ensure the relayer keypair is properly set up

### "Google Client ID not configured"
- Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- Check OAuth redirect URI matches your domain

### "Insufficient reimbursement"
- Check gas estimation accuracy
- Verify swap amounts account for slippage
- Ensure relayer has sufficient SUI balance

### Transaction failures
- Check Sui network status
- Verify transaction construction is correct
- Review transaction in Sui Explorer using the digest

## Next Steps

1. Integrate actual Cetus SDK
2. Implement proper balance queries
3. Add zkLogin proof generation
4. Add comprehensive error handling
5. Implement transaction monitoring
6. Add analytics and logging

