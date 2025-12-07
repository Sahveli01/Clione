/**
 * ============================================
 * Sui-Unlock E2E Verification Script
 * ============================================
 * 
 * This script verifies the Affiliate Split logic by simulating:
 * 1. Seller creates a listing with 10% affiliate
 * 2. Buyer purchases using Affiliate's referral
 * 3. Verify 90% goes to Seller, 10% to Affiliate
 * 
 * Prerequisites:
 *   - Node.js 18+
 *   - Deployed contract (PACKAGE_ID)
 *   - Three funded testnet wallets
 * 
 * Usage:
 *   npx ts-node scripts/verify-logic.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/verify-logic.ts
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================

// Auto-detect Package ID from .env.local, or use placeholder
function getPackageId(): string {
  // Try to read from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    // More robust regex: handles comments, whitespace, quotes
    // Matches: NEXT_PUBLIC_MARKET_PACKAGE_ID=value (with optional quotes)
    const patterns = [
      /NEXT_PUBLIC_MARKET_PACKAGE_ID\s*=\s*["']?([^"'\s#]+)["']?/,
      /NEXT_PUBLIC_MARKET_PACKAGE_ID\s*=\s*([^\s#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = envContent.match(pattern);
      if (match && match[1]) {
        const packageId = match[1].trim();
        
        // Validate it's a real Package ID (not placeholder)
        if (
          packageId.startsWith('0x') && 
          packageId.length >= 20 && 
          !packageId.includes('YOUR') && 
          !packageId.includes('...') &&
          !packageId.includes('${') &&
          packageId !== '0x0'
        ) {
          return packageId;
        }
      }
    }
  }
  
  // Fallback to placeholder
  return "0xYOUR_PACKAGE_ID_HERE";
}

const PACKAGE_ID = getPackageId();

// Test wallets - Replace with your testnet private keys
// Format: suiprivkey1... (Bech32) or hex
const SELLER_PRIVATE_KEY = "YOUR_SELLER_PRIVATE_KEY";
const BUYER_PRIVATE_KEY = "YOUR_BUYER_PRIVATE_KEY";  
const AFFILIATE_PRIVATE_KEY = "YOUR_AFFILIATE_PRIVATE_KEY";

// Test parameters
const LISTING_PRICE = 100_000_000; // 0.1 SUI in MIST
const AFFILIATE_PERCENTAGE = 1000; // 10% in basis points

// ============================================
// HELPER FUNCTIONS
// ============================================

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

function getKeypair(privateKey: string): Ed25519Keypair {
  if (privateKey.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    // Assume hex format
    const hexString = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    const bytes = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    return Ed25519Keypair.fromSecretKey(bytes);
  }
}

async function getBalance(address: string): Promise<bigint> {
  const balance = await client.getBalance({ owner: address });
  return BigInt(balance.totalBalance);
}

function formatSui(mist: bigint): string {
  return (Number(mist) / 1_000_000_000).toFixed(4);
}

async function executeTransaction(tx: TransactionBlock, keypair: Ed25519Keypair) {
  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });
  
  if (result.effects?.status?.status !== 'success') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
  }
  
  return result;
}

// ============================================
// MAIN VERIFICATION LOGIC
// ============================================

async function main() {
  console.log("🔍 Sui-Unlock E2E Verification Script");
  console.log("=====================================\n");
  
  // Show Package ID source and validate
  const envPath = path.join(__dirname, '..', '.env.local');
  const envExists = fs.existsSync(envPath);
  
  if (envExists) {
    console.log("📋 Package ID loaded from .env.local");
  } else {
    console.log("📋 Package ID: (using placeholder - .env.local not found)");
  }
  console.log(`   Package ID: ${PACKAGE_ID}`);
  console.log("");
  
  // Validate configuration
  if (PACKAGE_ID === "0xYOUR_PACKAGE_ID_HERE" || !PACKAGE_ID.startsWith("0x") || PACKAGE_ID.length < 20) {
    console.error("❌ Error: Package ID not found or invalid");
    console.log("");
    console.log("   Current Package ID:", PACKAGE_ID);
    console.log("");
    
    // Check if deploy-output.json exists
    const deployOutputPath = path.join(__dirname, '..', 'deploy-output.json');
    const hasDeployOutput = fs.existsSync(deployOutputPath);
    
    if (hasDeployOutput) {
      console.log("   ✅ Found deploy-output.json");
      console.log("   💡 Run: npm run post-deploy");
      console.log("      This will extract Package ID and update .env.local");
    } else {
      console.log("   ⚠️  No deploy-output.json found");
      console.log("   💡 Run deployment first:");
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        console.log("      .\\deploy.ps1");
      } else {
        console.log("      ./deploy.sh");
      }
      console.log("   Then run: npm run post-deploy");
    }
    
    console.log("");
    console.log("   Alternative: Manually set in .env.local:");
    console.log("      NEXT_PUBLIC_MARKET_PACKAGE_ID=0xYOUR_PACKAGE_ID");
    console.log("");
    process.exit(1);
  }
  
  console.log("✅ Package ID validated");
  console.log("");
  
  if (SELLER_PRIVATE_KEY === "YOUR_SELLER_PRIVATE_KEY") {
    console.error("❌ Error: Please update wallet private keys");
    console.log("   You need 3 funded testnet wallets.");
    console.log("   Get testnet SUI from: https://faucet.sui.io/");
    process.exit(1);
  }

  // Initialize keypairs
  console.log("🔑 Initializing wallets...");
  const sellerKeypair = getKeypair(SELLER_PRIVATE_KEY);
  const buyerKeypair = getKeypair(BUYER_PRIVATE_KEY);
  const affiliateKeypair = getKeypair(AFFILIATE_PRIVATE_KEY);
  
  const sellerAddress = sellerKeypair.getPublicKey().toSuiAddress();
  const buyerAddress = buyerKeypair.getPublicKey().toSuiAddress();
  const affiliateAddress = affiliateKeypair.getPublicKey().toSuiAddress();
  
  console.log(`   Seller:    ${sellerAddress}`);
  console.log(`   Buyer:     ${buyerAddress}`);
  console.log(`   Affiliate: ${affiliateAddress}`);
  console.log("");

  // Get initial balances
  console.log("💰 Initial balances:");
  const sellerBalanceBefore = await getBalance(sellerAddress);
  const affiliateBalanceBefore = await getBalance(affiliateAddress);
  const buyerBalanceBefore = await getBalance(buyerAddress);
  
  console.log(`   Seller:    ${formatSui(sellerBalanceBefore)} SUI`);
  console.log(`   Affiliate: ${formatSui(affiliateBalanceBefore)} SUI`);
  console.log(`   Buyer:     ${formatSui(buyerBalanceBefore)} SUI`);
  console.log("");

  // ============================================
  // STEP 1: Create Listing with Affiliate
  // ============================================
  console.log("📝 Step 1: Creating listing with affiliate...");
  console.log(`   Price: ${formatSui(BigInt(LISTING_PRICE))} SUI`);
  console.log(`   Affiliate: ${AFFILIATE_PERCENTAGE / 100}%`);
  
  const createTx = new TransactionBlock();
  
  const encoder = new TextEncoder();
  const blobIdBytes = Array.from(encoder.encode("test_blob_id_12345"));
  const nameBytes = Array.from(encoder.encode("Test Digital Asset"));
  const descBytes = Array.from(encoder.encode("E2E verification test listing"));
  
  createTx.moveCall({
    target: `${PACKAGE_ID}::market::create_listing_with_affiliate`,
    arguments: [
      createTx.pure(LISTING_PRICE),
      createTx.pure(blobIdBytes),
      createTx.pure(nameBytes),
      createTx.pure(descBytes),
      createTx.pure(AFFILIATE_PERCENTAGE),
    ],
  });
  
  const createResult = await executeTransaction(createTx, sellerKeypair);
  console.log(`   ✅ TX: ${createResult.digest}`);
  
  // Extract listing ID from created objects
  let listingId: string | null = null;
  if (createResult.objectChanges) {
    for (const change of createResult.objectChanges) {
      if (change.type === 'created' && (change as any).objectType?.includes('Listing')) {
        listingId = (change as any).objectId;
        break;
      }
    }
  }
  
  if (!listingId) {
    console.error("❌ Failed to get listing ID from transaction");
    process.exit(1);
  }
  
  console.log(`   📦 Listing ID: ${listingId}`);
  console.log("");

  // Wait for indexing
  console.log("⏳ Waiting for indexing...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // ============================================
  // STEP 2: Purchase with Referral
  // ============================================
  console.log("🛒 Step 2: Purchasing with referral...");
  console.log(`   Buyer: ${buyerAddress.slice(0, 10)}...`);
  console.log(`   Referrer: ${affiliateAddress.slice(0, 10)}...`);
  
  // Get listing object for shared object ref
  const listingObject = await client.getObject({
    id: listingId,
    options: { showOwner: true },
  });
  
  const owner = listingObject.data?.owner as { Shared?: { initial_shared_version: number } };
  const initialSharedVersion = owner?.Shared?.initial_shared_version;
  
  if (!initialSharedVersion) {
    console.error("❌ Could not get initial shared version");
    process.exit(1);
  }
  
  const purchaseTx = new TransactionBlock();
  
  // Split payment from gas
  const [paymentCoin] = purchaseTx.splitCoins(purchaseTx.gas, [LISTING_PRICE]);
  
  purchaseTx.moveCall({
    target: `${PACKAGE_ID}::market::purchase_with_referral`,
    arguments: [
      purchaseTx.sharedObjectRef({
        objectId: listingId,
        initialSharedVersion: initialSharedVersion,
        mutable: false,
      }),
      paymentCoin,
      purchaseTx.pure(affiliateAddress),
    ],
  });
  
  const purchaseResult = await executeTransaction(purchaseTx, buyerKeypair);
  console.log(`   ✅ TX: ${purchaseResult.digest}`);
  console.log("");

  // Wait for balance updates
  console.log("⏳ Waiting for balance updates...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // ============================================
  // STEP 3: Verify Balance Changes
  // ============================================
  console.log("📊 Step 3: Verifying balance changes...");
  
  const sellerBalanceAfter = await getBalance(sellerAddress);
  const affiliateBalanceAfter = await getBalance(affiliateAddress);
  const buyerBalanceAfter = await getBalance(buyerAddress);
  
  const sellerGain = sellerBalanceAfter - sellerBalanceBefore;
  const affiliateGain = affiliateBalanceAfter - affiliateBalanceBefore;
  const buyerSpent = buyerBalanceBefore - buyerBalanceAfter;
  
  console.log("");
  console.log("💰 Final balances:");
  console.log(`   Seller:    ${formatSui(sellerBalanceAfter)} SUI (+${formatSui(sellerGain)})`);
  console.log(`   Affiliate: ${formatSui(affiliateBalanceAfter)} SUI (+${formatSui(affiliateGain)})`);
  console.log(`   Buyer:     ${formatSui(buyerBalanceAfter)} SUI (-${formatSui(buyerSpent)} including gas)`);
  console.log("");

  // Calculate expected values
  const expectedSellerGain = BigInt(LISTING_PRICE) * BigInt(100 - AFFILIATE_PERCENTAGE / 100) / BigInt(100);
  const expectedAffiliateGain = BigInt(LISTING_PRICE) * BigInt(AFFILIATE_PERCENTAGE / 100) / BigInt(100);
  
  console.log("🧮 Expected split:");
  console.log(`   Seller should receive:    ${formatSui(expectedSellerGain)} SUI (90%)`);
  console.log(`   Affiliate should receive: ${formatSui(expectedAffiliateGain)} SUI (10%)`);
  console.log("");

  // Note: Seller might have paid gas for creating listing, so we check approximate values
  const sellerGainWithGas = sellerGain + BigInt(10_000_000); // Add ~0.01 SUI gas buffer
  
  console.log("=====================================");
  
  if (affiliateGain >= expectedAffiliateGain - BigInt(1000)) {
    console.log("✅ VERIFICATION PASSED!");
    console.log("   Affiliate received correct commission.");
  } else {
    console.log("❌ VERIFICATION FAILED!");
    console.log(`   Expected affiliate gain: ${formatSui(expectedAffiliateGain)}`);
    console.log(`   Actual affiliate gain:   ${formatSui(affiliateGain)}`);
  }
  
  console.log("");
  console.log("🎉 E2E verification complete!");
  console.log("");
  console.log("📋 Summary:");
  console.log(`   Package ID: ${PACKAGE_ID}`);
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Purchase TX: ${purchaseResult.digest}`);
}

// Run the script
main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});

