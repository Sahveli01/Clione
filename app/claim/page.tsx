"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Download,
  Lock,
  Unlock,
  ShoppingCart,
  ExternalLink,
  Sparkles,
  Wallet,
  Users,
  Gift
} from "lucide-react";
import Link from "next/link";
import { useCurrentAccount, useSignAndExecuteTransactionBlock, ConnectButton } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SUI_CLIENT, mistToSui } from "@/lib/sui-utils";
import { downloadFromWalrus, getWalrusExplorerUrl } from "@/lib/walrus-utils";
import { 
  decodeUnlockData, 
  parseEncryptedPayload, 
  decryptFile, 
  triggerDownload 
} from "@/lib/crypto-utils";

// Move Package ID for sui_drop::market
const MARKET_PACKAGE_ID = process.env.NEXT_PUBLIC_MARKET_PACKAGE_ID || 
  "0x7b2cc638645ff06da257723482f426658a15b18e310d53f5db3cf342323a8b8a";

type PurchaseState = "idle" | "purchasing" | "success" | "downloading" | "error";

interface ListingInfo {
  id: string;
  seller: string;
  price: string;
  blobId: string; // Changed from ipfsCid to blobId
  name: string;
  description: string;
  isActive: boolean;
  affiliatePercentage: number;
}

function BuyPageContent() {
  const searchParams = useSearchParams();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransactionBlock();

  // URL Parameters
  const [listingId, setListingId] = useState<string | null>(null);
  const [unlockData, setUnlockData] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  
  // Listing State
  const [listing, setListing] = useState<ListingInfo | null>(null);
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);
  
  // Purchase State
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  // Parse URL parameters
  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = searchParams.get("id");
    const ref = searchParams.get("ref");
    const hash = window.location.hash.slice(1); // Remove #

    console.log("📝 Parsing URL...");
    console.log("   - Listing ID:", id);
    console.log("   - Referrer:", ref);
    console.log("   - Has unlock data:", !!hash);

    if (id) {
      setListingId(id);
    }
    if (ref) {
      setReferrer(ref);
    }
    if (hash) {
      setUnlockData(hash);
    }
  }, [searchParams]);

  // Fetch listing details from chain
  useEffect(() => {
    if (!listingId) {
      setIsLoadingListing(false);
      return;
    }

    const fetchListing = async (retryCount = 0) => {
      setIsLoadingListing(true);
      setListingError(null);

      try {
        const object = await SUI_CLIENT.getObject({
          id: listingId,
          options: { showContent: true },
        });

        if (!object.data || !object.data.content) {
          // If listing not found and we haven't retried, wait a bit and retry (for newly created listings)
          if (retryCount < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            return fetchListing(retryCount + 1);
          }
          setListingError("Listing not found. It may not exist yet or the link is invalid.");
          setIsLoadingListing(false);
          return;
        }

        const content = object.data.content as unknown as {
          dataType: string;
          fields?: {
            seller?: string;
            price?: string;
            blob_id?: number[] | string;
            blobId?: number[] | string; // camelCase variant (Sui SDK conversion)
            name?: number[];
            description?: number[];
            is_active?: boolean;
            isActive?: boolean; // camelCase variant
            affiliate_percentage?: string;
            affiliatePercentage?: string; // camelCase variant
          };
        };

        // Validate content structure
        if (content.dataType !== "moveObject") {
          setListingError("Invalid listing format. This listing may be corrupted.");
          setIsLoadingListing(false);
          return;
        }

        if (!content.fields) {
          setListingError("Invalid listing format. Missing required data.");
          setIsLoadingListing(false);
          return;
        }

        // Debug: Log all available field keys
        console.log("🔍 All field keys:", Object.keys(content.fields));
        console.log("🔍 Raw fields object:", content.fields);

        const decoder = new TextDecoder();
        const fields = content.fields;
        
        /**
         * Bulletproof Content ID Extractor
         * Finds the Walrus Content ID from the Listing object regardless of field name
         */
        const extractBlobId = (fields: any): string => {
          // Known field name variations (in priority order)
          const knownFieldNames = [
            'blob_id',      // Exact Move contract name (snake_case)
            'blobId',       // camelCase variant (Sui SDK conversion)
            'ipfs_cid',     // Legacy name
            'ipfsCid',      // Legacy camelCase
            'contentId',    // Alternative naming
            'content_id',   // Alternative snake_case
            'walrusId',     // Alternative naming
            'walrus_id',    // Alternative snake_case
          ];
          
          // Step 1: Try known field names first
          for (const fieldName of knownFieldNames) {
            const fieldValue = fields[fieldName];
            if (fieldValue !== undefined && fieldValue !== null) {
              console.log(`✅ Found field "${fieldName}":`, fieldValue);
              const decoded = decodeFieldValue(fieldValue, decoder);
              if (decoded) {
                console.log(`✅ Successfully extracted blobId from "${fieldName}":`, decoded);
                return decoded;
              }
            }
          }
          
          // Step 2: Fallback - Iterate through all fields to find content ID
          console.log("⚠️ Known field names not found, searching all fields...");
          const fieldKeys = Object.keys(fields);
          
          for (const key of fieldKeys) {
            // Skip non-content-ID fields
            if (['id', 'seller', 'price', 'is_active', 'isActive', 'affiliate_percentage', 'affiliatePercentage'].includes(key)) {
              continue;
            }
            
            const fieldValue = fields[key];
            console.log(`🔍 Checking field "${key}":`, fieldValue, `(type: ${typeof fieldValue}, isArray: ${Array.isArray(fieldValue)})`);
            
            // Check if this looks like a content ID
            if (isContentIdCandidate(fieldValue)) {
              console.log(`🎯 Field "${key}" looks like a content ID candidate`);
              const decoded = decodeFieldValue(fieldValue, decoder);
              if (decoded && decoded.length > 0) {
                console.log(`✅ Successfully extracted blobId from field "${key}":`, decoded);
                return decoded;
              }
            }
          }
          
          console.error("❌ Could not find blobId in any field");
          return "";
        };
        
        /**
         * Checks if a field value looks like a content ID
         */
        const isContentIdCandidate = (value: any): boolean => {
          if (!value) return false;
          
          // Non-empty array of numbers (vector<u8> from Move)
          if (Array.isArray(value) && value.length > 0) {
            // Check if all elements are numbers
            const allNumbers = value.every((item: any) => typeof item === 'number' && !isNaN(item));
            if (allNumbers) {
              console.log(`   ✓ Array of ${value.length} numbers detected`);
              return true;
            }
            // Check if all elements are strings (could be string array)
            const allStrings = value.every((item: any) => typeof item === 'string');
            if (allStrings && value.length > 0) {
              console.log(`   ✓ Array of ${value.length} strings detected`);
              return true;
            }
          }
          
          // Non-empty string (could be pre-decoded)
          if (typeof value === 'string' && value.trim().length > 0) {
            console.log(`   ✓ Non-empty string detected (length: ${value.length})`);
            return true;
          }
          
          return false;
        };
        
        /**
         * Decodes a field value to string (handles all formats)
         */
        const decodeFieldValue = (value: any, decoder: TextDecoder): string => {
          if (!value) return "";
          
          try {
            // Already a string
            if (typeof value === "string") {
              const trimmed = value.trim();
              if (trimmed.length > 0) {
                return trimmed;
              }
            }
            
            // Array of numbers (vector<u8> from Move)
            if (Array.isArray(value) && value.length > 0) {
              // Try standard UTF-8 decode
              try {
                const uint8Array = new Uint8Array(value);
                const decoded = decoder.decode(uint8Array);
                if (decoded && decoded.length > 0) {
                  return decoded;
                }
              } catch (e) {
                console.warn("   ⚠️ Standard decode failed, trying alternatives...");
              }
              
              // Try string array join
              if (typeof value[0] === "string") {
                const joined = value.join("");
                if (joined.length > 0) {
                  return joined;
                }
              }
              
              // Try char code conversion
              try {
                const charCodes = value.map((v: any) => {
                  const num = typeof v === 'string' ? parseInt(v, 10) : v;
                  return isNaN(num) ? 0 : num;
                }).filter((n: number) => n >= 0 && n <= 255);
                
                if (charCodes.length > 0) {
                  const decoded = String.fromCharCode(...charCodes);
                  if (decoded.length > 0) {
                    return decoded;
                  }
                }
              } catch (e) {
                console.warn("   ⚠️ Char code conversion failed");
              }
            }
          } catch (e) {
            console.error("   ❌ Decode error:", e);
          }
          
          return "";
        };
        
        // Extract blobId using bulletproof method
        const blobId = extractBlobId(fields);
        
        console.log("🔍 Final blobId:", blobId);
        console.log("🔍 blobId length:", blobId.length);
        console.log("🔍 blobId is empty:", !blobId || blobId.trim() === "");

        // Validate required fields (handle both snake_case and camelCase)
        const seller = fields.seller;
        const price = fields.price;
        const nameField = fields.name;
        const descriptionField = fields.description;
        const isActiveField = fields.isActive ?? fields.is_active ?? true;
        const affiliatePercentageField = fields.affiliatePercentage ?? fields.affiliate_percentage;
        
        if (!seller || !price || !nameField || !descriptionField) {
          console.error("❌ Missing required fields:");
          console.error("   seller:", seller);
          console.error("   price:", price);
          console.error("   name:", nameField);
          console.error("   description:", descriptionField);
          setListingError("Invalid listing format. Missing required data.");
          setIsLoadingListing(false);
          return;
        }
        
        try {
          setListing({
            id: listingId,
            seller: seller,
            price: price,
            blobId: blobId,
            name: decoder.decode(new Uint8Array(nameField)),
            description: decoder.decode(new Uint8Array(descriptionField)),
            isActive: isActiveField,
            affiliatePercentage: affiliatePercentageField ? parseInt(affiliatePercentageField) / 100 : 0,
          });
        } catch (decodeError) {
          setListingError("Failed to decode listing data. The listing may be corrupted.");
          setIsLoadingListing(false);
          return;
        }
      } catch (error) {
        // If it's a network error and we haven't retried, retry
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchListing(retryCount + 1);
        }
        setListingError("Failed to load listing. It may not exist or network error.");
      } finally {
        setIsLoadingListing(false);
      }
    };

    fetchListing();
  }, [listingId]);

  // Handle purchase
  const handlePurchase = useCallback(async () => {
    if (!currentAccount || !listing) return;

    setPurchaseState("purchasing");
    setPurchaseError(null);

    try {
      // First, get the listing object details from chain
      const listingObject = await SUI_CLIENT.getObject({
        id: listing.id,
        options: { showOwner: true },
      });
      
      if (!listingObject.data) {
        throw new Error("Listing not found on chain");
      }
      
      // Get the initial shared version
      const owner = listingObject.data.owner as { Shared?: { initial_shared_version: number } };
      const initialSharedVersion = owner?.Shared?.initial_shared_version;
      
      console.log("📦 Listing object:", listingObject.data);
      console.log("📦 Initial shared version:", initialSharedVersion);
      console.log("👥 Referrer:", referrer);

      const tx = new TransactionBlock();
      
      // Convert price to number (MIST)
      const priceAmount = Number(listing.price);
      console.log("💰 Purchase amount:", priceAmount, "MIST");
      
      // Get the payment amount - split from gas coin
      const [paymentCoin] = tx.splitCoins(tx.gas, [priceAmount]);
      
      // Determine which function to call based on referrer
      const hasValidReferrer = referrer && 
        referrer !== currentAccount.address && 
        referrer !== listing.seller &&
        listing.affiliatePercentage > 0;
      
      if (hasValidReferrer) {
        console.log("👥 Using purchase_with_referral");
        // Call purchase_with_referral function
        if (initialSharedVersion) {
          tx.moveCall({
            target: `${MARKET_PACKAGE_ID}::market::purchase_with_referral`,
            arguments: [
              tx.sharedObjectRef({
                objectId: listing.id,
                initialSharedVersion: initialSharedVersion,
                mutable: false,
              }),
              paymentCoin,
              tx.pure(referrer),
            ],
          });
        } else {
          tx.moveCall({
            target: `${MARKET_PACKAGE_ID}::market::purchase_with_referral`,
            arguments: [
              tx.object(listing.id),
              paymentCoin,
              tx.pure(referrer),
            ],
          });
        }
      } else {
        console.log("💸 Using standard purchase");
        // Call standard purchase function
        if (initialSharedVersion) {
          tx.moveCall({
            target: `${MARKET_PACKAGE_ID}::market::purchase`,
            arguments: [
              tx.sharedObjectRef({
                objectId: listing.id,
                initialSharedVersion: initialSharedVersion,
                mutable: false,
              }),
              paymentCoin,
            ],
          });
        } else {
      tx.moveCall({
        target: `${MARKET_PACKAGE_ID}::market::purchase`,
        arguments: [
              tx.object(listing.id),
          paymentCoin,
        ],
      });
        }
      }

      signAndExecuteTransaction(
        { transactionBlock: tx as any },
        {
          onSuccess: async (result) => {
            console.log("✅ Purchase successful!");
            console.log("   Digest:", result.digest);
            setTxDigest(result.digest);
            
            // CRITICAL FIX: Do NOT auto-download. User must click "Download Again" button
            setPurchaseState("success");
          },
          onError: (error) => {
            console.error("❌ Purchase failed:", error);
            setPurchaseError(error.message || "Transaction failed");
            setPurchaseState("error");
          },
        }
      );
    } catch (error) {
      console.error("❌ Error:", error);
      setPurchaseError(error instanceof Error ? error.message : "An error occurred");
      setPurchaseState("error");
    }
  }, [currentAccount, listing, signAndExecuteTransaction, referrer]);

  // Handle file download & decryption
  const handleDownload = useCallback(async () => {
    if (!unlockData || !listing) {
      setPurchaseError("Missing unlock key - the link may be incomplete");
      return;
    }

    setPurchaseState("downloading");

    try {
      // Decode unlock data from URL
      const { key, fileName, fileType } = await decodeUnlockData(unlockData);
      console.log("🔑 Unlock data decoded");
      console.log("   - File:", fileName);

      // Validate blobId before attempting download
      if (!listing.blobId || listing.blobId.trim() === "") {
        throw new Error("Listing has no blob ID. Cannot download file.");
      }
      
      // Fetch encrypted file from Walrus 🦭
      console.log("🦭 Fetching from Walrus...");
      console.log("   Blob ID:", listing.blobId);
      const encryptedPayload = await downloadFromWalrus(listing.blobId);
      console.log("🦭 Downloaded from Walrus");
      
      // Parse IV and encrypted data
      const { iv, encryptedData } = parseEncryptedPayload(encryptedPayload);

      // Decrypt file
      const decryptedFile = await decryptFile(encryptedData, key, iv, fileName, fileType);
      console.log("🔓 File decrypted");

      // Trigger download
      triggerDownload(decryptedFile);
      console.log("📥 Download triggered");

      setPurchaseState("success");
    } catch (error) {
      console.error("❌ Download failed:", error);
      setPurchaseError(error instanceof Error ? error.message : "Download failed");
      setPurchaseState("error");
    }
  }, [unlockData, listing]);

  // ============ RENDER: Loading State ============
  if (isLoadingListing) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading listing...</p>
        </div>
      </main>
    );
  }

  // ============ RENDER: Invalid Listing ============
  if (!listingId || listingError) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center bg-black">
        <div className="max-w-md w-full">
          <div className="bg-gray-900/50 border border-red-500/50 rounded-2xl p-8 text-center backdrop-blur-sm">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Invalid Link</h1>
            <p className="text-gray-300 mb-4">
              {listingError || "This link is missing required parameters."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ============ RENDER: Main Buy Page ============
  return (
    <main className="min-h-screen p-8 bg-black">
      <div className="max-w-lg mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        {/* Referral Banner */}
        {referrer && listing?.affiliatePercentage && listing.affiliatePercentage > 0 && (
          <div className="glass-card p-3 mb-4 border-purple-500/30 flex items-center gap-3">
            <Gift className="w-5 h-5 text-purple-400 shrink-0" />
            <p className="text-sm text-purple-300">
              You were referred! {listing.affiliatePercentage}% goes to your referrer.
            </p>
          </div>
        )}

        {/* Listing Card */}
        <div className="glass-card p-8 mb-6 border-purple-500/30">
            {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center">
              {purchaseState === "success" ? (
                <Unlock className="w-8 h-8 text-emerald-400" />
              ) : (
                <Lock className="w-8 h-8 text-violet-400" />
              )}
                </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                {listing?.name || "Digital Asset"}
                  </h1>
              <p className="text-gray-400 text-sm">
                {listing?.description || "No description"}
                  </p>
              </div>
            </div>

          {/* Price Display */}
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 mb-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
                <span className="text-gray-400 font-medium">Price</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white">
                  {listing ? mistToSui(BigInt(listing.price)).toFixed(2) : "0.00"}
                </span>
                <span className="text-purple-400 font-medium">SUI</span>
              </div>
            </div>
            {listing?.affiliatePercentage && listing.affiliatePercentage > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <Users className="w-3 h-3" />
                <span>{listing.affiliatePercentage}% affiliate commission available</span>
              </div>
            )}
              </div>

          {/* Wallet Connection / Purchase Button */}
          {!currentAccount ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <p className="text-sm text-amber-200">
                    Connect your wallet to purchase this asset
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : purchaseState === "idle" || purchaseState === "error" ? (
            <div className="space-y-4">
              {purchaseError && (
                <div className="glass-card p-4 border-red-500/30">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-sm text-red-400">{purchaseError}</p>
                  </div>
                </div>
              )}
              
              <button
                onClick={handlePurchase}
                disabled={!listing}
                className="btn-primary w-full"
              >
                <ShoppingCart className="w-5 h-5" />
                {`Purchase for ${listing ? mistToSui(BigInt(listing.price)).toFixed(2) : "0"} SUI`}
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                Payment goes directly to the creator&apos;s wallet
              </p>
            </div>
          ) : purchaseState === "purchasing" ? (
            <div className="text-center py-8">
              <div className="relative w-20 h-20 mx-auto mb-4">
                {/* Rotating Gradient Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin-slow">
                  <div className="absolute inset-0 rounded-full border-t-4 border-purple-500/60 border-r-4 border-pink-500/60 border-b-4 border-teal-500/60 border-l-4 border-purple-500/60"></div>
                </div>
                {/* Pulsing Outer Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-teal-500/40 animate-pulse"></div>
                {/* Inner Glow Circle */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/30 to-teal-500/30 animate-pulse"></div>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                </div>
              </div>
              <p className="text-gray-300 font-medium">Confirming purchase...</p>
              <p className="text-xs text-gray-500 mt-1">Please approve the transaction</p>
            </div>
          ) : purchaseState === "downloading" ? (
            <div className="text-center py-8">
              <div className="relative w-20 h-20 mx-auto mb-4">
                {/* Rotating Gradient Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin-slow">
                  <div className="absolute inset-0 rounded-full border-t-4 border-purple-500/60 border-r-4 border-pink-500/60 border-b-4 border-teal-500/60 border-l-4 border-purple-500/60"></div>
                </div>
                {/* Pulsing Outer Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-teal-500/40 animate-pulse"></div>
                {/* Inner Glow Circle */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/30 to-teal-500/30 animate-pulse"></div>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/50">
                    <Download className="w-6 h-6 text-white animate-pulse" />
                  </div>
                </div>
              </div>
              <p className="text-gray-300 font-medium">🦭 Fetching from Walrus & Decrypting...</p>
            </div>
          ) : purchaseState === "success" ? (
            <div className="space-y-4">
              <div className="glass-card p-4 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-emerald-400 font-semibold">Purchase Complete!</p>
                    <p className="text-xs text-emerald-200/70">
                      Click the button below to download your file
                    </p>
                  </div>
                </div>
              </div>

              {/* Premium Glass Panel for TX Digest & Links */}
              {(txDigest || listing?.blobId) && (
                <div className="glass-card p-4 border-[var(--accent-teal-border)]/30 shadow-[0_0_20px_rgba(0,246,255,0.1)]">
                  {txDigest && (
                    <div className="mb-3 pb-3 border-b border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                        <span className="text-[var(--accent-teal)]">🔗</span>
                        <span>Transaction Digest</span>
                      </p>
                      <a 
                        href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs break-all font-mono text-[var(--accent-teal)] hover:text-teal-300 flex items-center gap-2 transition-colors bg-black/20 p-2 rounded-lg border border-teal-500/20 hover:border-teal-500/40"
                      >
                        {txDigest}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {listing?.blobId && listing.blobId.trim() !== "" && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                        <span className="text-[var(--accent-teal)]">🦭</span>
                        <span>Walrus Blob ID</span>
                      </p>
                      <a 
                        href={getWalrusExplorerUrl(listing.blobId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs break-all font-mono text-[var(--accent-teal)] hover:text-teal-300 flex items-center gap-2 transition-colors bg-black/20 p-2 rounded-lg border border-teal-500/20 hover:border-teal-500/40"
                      >
                        {listing.blobId}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleDownload}
                className="btn-primary w-full"
              >
                <Download className="w-5 h-5" />
                Download File
              </button>
            </div>
          ) : null}
            </div>

        {/* Walrus Storage Info */}
        {listing?.blobId && listing.blobId.trim() !== "" && (
          <div className="glass-card p-4 mb-4 border-[var(--accent-teal-border)]/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🦭</span>
              <div>
                <p className="text-sm font-semibold text-[var(--accent-teal)] mb-1">
                  Stored on Walrus
                </p>
                <a 
                  href={getWalrusExplorerUrl(listing.blobId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-300/70 hover:text-teal-200 flex items-center gap-1 transition-colors"
                >
                  View on Walrus Explorer
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Security Info */}
        <div className="glass-card p-4 border-purple-500/30">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-purple-400 mb-1">
                End-to-End Encryption
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                This file is encrypted with AES-256-GCM. The decryption key is in the URL and 
                never stored on-chain. Only you can decrypt the file after purchase.
              </p>
            </div>
          </div>
        </div>

        {/* Seller Info */}
        {listing?.seller && (
          <div className="mt-4 text-center text-xs text-gray-500">
            <span>Sold by </span>
            <code className="text-gray-400">
              {listing.seller.slice(0, 8)}...{listing.seller.slice(-6)}
            </code>
          </div>
        )}
      </div>
    </main>
  );
}

// Wrap with Suspense for useSearchParams
export default function BuyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    }>
      <BuyPageContent />
    </Suspense>
  );
}
