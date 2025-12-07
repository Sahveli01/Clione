"use client";

import { useState, useCallback } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransactionBlock } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  generateEncryptionKey, 
  encryptFile, 
  createEncryptedPayload,
  encodeUnlockData 
} from '@/lib/crypto-utils';
import { suiToMist } from '@/lib/sui-utils';
import { uploadToWalrus, getWalrusExplorerUrl } from '@/lib/walrus-utils';
import { 
  Upload, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  Loader2,
  FileText,
  DollarSign,
  X,
  Sparkles,
  Users,
  Percent,
  Plus,
  Minus
} from 'lucide-react';
import ProcessingAnimation from '@/components/ui/ProcessingAnimation';

// Move Package ID for sui_drop::market
const MARKET_PACKAGE_ID = process.env.NEXT_PUBLIC_MARKET_PACKAGE_ID || 
  "0x7b2cc638645ff06da257723482f426658a15b18e310d53f5db3cf342323a8b8a";

export default function SellPage() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransactionBlock();

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.1');
  const [affiliatePercentage, setAffiliatePercentage] = useState('10'); // Default 10%
  const [enableAffiliate, setEnableAffiliate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Result State
  const [generatedLink, setGeneratedLink] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [affiliateLinkCopied, setAffiliateLinkCopied] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [blobId, setBlobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, "")); // Remove extension
      }
    }
  }, [title]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const incrementPrice = () => {
    const currentPrice = parseFloat(price) || 0;
    const newPrice = (currentPrice + 0.01).toFixed(2);
    setPrice(newPrice);
  };

  const decrementPrice = () => {
    const currentPrice = parseFloat(price) || 0;
    if (currentPrice > 0.01) {
      const newPrice = (currentPrice - 0.01).toFixed(2);
      setPrice(newPrice);
    }
  };

  const incrementAffiliatePercentage = () => {
    const currentPercentage = parseInt(affiliatePercentage) || 0;
    if (currentPercentage < 10) {
      setAffiliatePercentage(String(currentPercentage + 1));
    }
  };

  const decrementAffiliatePercentage = () => {
    const currentPercentage = parseInt(affiliatePercentage) || 0;
    if (currentPercentage > 1) {
      setAffiliatePercentage(String(currentPercentage - 1));
    }
  };

  const handleCreateListing = async () => {
    if (!currentAccount || !file || !title || !price) return;
    
      setIsLoading(true);
      setUploadProgress(0);
      setError(null);
      setGeneratedLink('');
      setAffiliateLink('');
      setTxDigest(null);
      setListingId(null);
      setBlobId(null);

    try {
      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setError("Please enter a valid price");
        setIsLoading(false);
        return;
      }

      // Validate affiliate percentage
      const affiliateNum = parseInt(affiliatePercentage) || 0;
      if (enableAffiliate && (affiliateNum < 1 || affiliateNum > 10)) {
        setError("Affiliate percentage must be between 1% and 10%");
        setIsLoading(false);
        return;
      }

      // Step 1: Generate encryption key
      setLoadingStep("🔐 Generating encryption key...");
      setUploadProgress(10);
      const encryptionKey = await generateEncryptionKey();
      console.log("🔐 Encryption key generated");

      // Step 2: Encrypt the file
      setLoadingStep("🔒 Encrypting file...");
      setUploadProgress(30);
      const { encryptedBlob, iv, originalName, originalType } = await encryptFile(file, encryptionKey);
      console.log("🔒 File encrypted");

      // Step 3: Create combined payload (IV + encrypted data)
      setLoadingStep("📦 Preparing encrypted payload...");
      setUploadProgress(50);
      const encryptedPayload = await createEncryptedPayload(encryptedBlob, iv);

      // Step 4: Upload to Walrus 🦭
      setLoadingStep("🦭 Uploading to Walrus...");
      setUploadProgress(70);
      const walrusBlobId = await uploadToWalrus(encryptedPayload);
      console.log("🦭 Uploaded to Walrus:", walrusBlobId);
      setBlobId(walrusBlobId);

      // Step 5: Create unlock data for URL
      setLoadingStep("🔗 Creating unlock data...");
      setUploadProgress(80);
      const unlockData = await encodeUnlockData(encryptionKey, originalName, originalType);
      console.log("🔗 Unlock data created");

      // Step 6: Build transaction
      setLoadingStep("⛓️ Creating listing on Sui...");
      setUploadProgress(90);
      const tx = new TransactionBlock();
      
      const priceInMist = suiToMist(priceNum);
      const affiliateBasisPoints = enableAffiliate ? affiliateNum * 100 : 0; // Convert % to basis points
      
      // Convert strings to bytes
      const encoder = new TextEncoder();
      const blobIdBytes = Array.from(encoder.encode(walrusBlobId));
      const nameBytes = Array.from(encoder.encode(title));
      const descBytes = Array.from(encoder.encode(description || "No description"));

      // Validate Package ID is set
      if (!MARKET_PACKAGE_ID || MARKET_PACKAGE_ID === '0x0') {
        setError("Package ID not configured. Please set NEXT_PUBLIC_MARKET_PACKAGE_ID in .env.local");
        setIsLoading(false);
        return;
      }

      // Use create_listing_with_affiliate if affiliate is enabled
      // Defensive: Always use the correct function based on toggle state
      if (enableAffiliate && affiliateBasisPoints > 0) {
        // Affiliate enabled - use create_listing_with_affiliate
        tx.moveCall({
          target: `${MARKET_PACKAGE_ID}::market::create_listing_with_affiliate`,
          arguments: [
            tx.pure(priceInMist),
            tx.pure(blobIdBytes),
            tx.pure(nameBytes),
            tx.pure(descBytes),
            tx.pure(affiliateBasisPoints),
          ],
        });
        console.log("📝 Using create_listing_with_affiliate with", affiliateBasisPoints, "basis points");
      } else {
        // Affiliate disabled - use simple create_listing
        tx.moveCall({
          target: `${MARKET_PACKAGE_ID}::market::create_listing`,
          arguments: [
            tx.pure(priceInMist),
            tx.pure(blobIdBytes),
            tx.pure(nameBytes),
            tx.pure(descBytes),
          ],
        });
        console.log("📝 Using create_listing (no affiliate)");
      }

      console.log("🚀 Executing transaction...");

      // Step 7: Sign & Execute
      signAndExecuteTransaction(
        { 
          transactionBlock: tx as any,
        },
        {
          onSuccess: async (result) => {
            console.log("✅ Listing created!");
            console.log("   Digest:", result.digest);
            
            let createdListingId: string | null = null;
            
            // Method 1: Try to get from result directly
            if (result.effects?.created) {
              for (const created of result.effects.created) {
                if (created.reference?.objectId) {
                  createdListingId = created.reference.objectId;
                  console.log("   Found from effects:", createdListingId);
                  break;
                }
              }
            }
            
            // Method 2: Fetch from chain if not found
            if (!createdListingId) {
              console.log("   Fetching from chain...");
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              try {
                const { SUI_CLIENT } = await import('@/lib/sui-utils');
                const txDetails = await SUI_CLIENT.getTransactionBlock({
                  digest: result.digest,
                  options: { showObjectChanges: true, showEffects: true },
                });
                
                // Try objectChanges
                if (txDetails.objectChanges) {
                  for (const change of txDetails.objectChanges) {
                    if (change.type === "created") {
                      const obj = change as any;
                      if (obj.objectType?.includes("Listing") || obj.objectType?.includes("market")) {
                        createdListingId = obj.objectId;
                        console.log("   Found from objectChanges:", createdListingId);
                        break;
                      }
                    }
                  }
                }
                
                // Try effects.created
                if (!createdListingId && txDetails.effects?.created) {
                  for (const created of txDetails.effects.created as any[]) {
                    const objId = created.reference?.objectId || created.objectId;
                    if (objId && objId.length === 66) {
                      createdListingId = objId;
                      console.log("   Found from effects.created:", createdListingId);
                      break;
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to fetch tx details:", e);
              }
            }
            
            if (!createdListingId) {
              const explorerUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
              console.error("❌ Failed to get listing ID. Check:", explorerUrl);
              setError(`Transaction successful! Check Sui Explorer to get listing ID.`);
              setTxDigest(result.digest);
              setIsLoading(false);
              return;
            }
            
            console.log("📦 Listing ID:", createdListingId);
            setListingId(createdListingId);
            setTxDigest(result.digest);

            // Generate the unlock URL
            const baseUrl = window.location.origin;
            const unlockUrl = `${baseUrl}/claim?id=${createdListingId}#${unlockData}`;
            
            console.log("🔗 Unlock URL generated:", unlockUrl);
            setGeneratedLink(unlockUrl);

            // Generate affiliate link if enabled
            if (enableAffiliate && currentAccount?.address) {
              const affLink = `${baseUrl}/claim?id=${createdListingId}&ref=${currentAccount.address}#${unlockData}`;
              setAffiliateLink(affLink);
              console.log("👥 Affiliate URL generated:", affLink);
            }

            setUploadProgress(100);
            setIsLoading(false);
          },
          onError: (error) => {
            console.error("❌ Transaction failed:", error);
            
            // Enhanced error handling for function not found errors
            const errorMessage = error.message || String(error);
            let userFriendlyError = "Transaction failed! See console for details.";
            
            if (errorMessage.includes("No function was found") || 
                errorMessage.includes("function name") ||
                errorMessage.includes("create_listing_with_affiliate")) {
              userFriendlyError = `Function not found on-chain. The Package ID (${MARKET_PACKAGE_ID}) may point to an old deployment.\n\nPlease:\n1. Re-deploy the contract: ./deploy.sh\n2. Update .env.local with the new Package ID\n3. Restart the dev server`;
            } else if (errorMessage.includes("Package ID") || errorMessage.includes("package")) {
              userFriendlyError = `Invalid Package ID: ${MARKET_PACKAGE_ID}\n\nPlease update NEXT_PUBLIC_MARKET_PACKAGE_ID in .env.local`;
            }
            
            setError(userFriendlyError);
            setUploadProgress(0);
            setIsLoading(false);
          }
        }
      );

    } catch (e) {
      console.error("❌ Error:", e);
      setError(e instanceof Error ? e.message : "An error occurred");
      setUploadProgress(0);
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyAffiliateLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    setAffiliateLinkCopied(true);
    setTimeout(() => setAffiliateLinkCopied(false), 2000);
  };

  return (
    <>
      <ProcessingAnimation 
        isVisible={isLoading} 
        currentStep={loadingStep}
        progress={uploadProgress}
      />
      <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center">
      <div className={`max-w-lg w-full transition-opacity duration-300 ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Create Paywall</span>
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Sell Your Digital Asset
          </h1>
          <p className="text-gray-400">
            Upload, encrypt, and store on Walrus 🦭
          </p>
        </div>

        <div className="glass-card p-6">
          {/* Wallet Connection */}
          <div className="flex justify-end mb-6">
            <ConnectButton />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* File Upload Zone */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              Digital Asset
            </label>
            
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer backdrop-blur-sm ${
                  isDragging 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-gray-700/50 hover:border-[var(--accent-teal-border)] hover:bg-gray-800/30'
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-violet-400' : 'text-gray-500'}`} />
                  <p className="text-gray-300 font-medium">
                    {isDragging ? 'Drop your file here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDFs, Images, Videos, Audio, Archives - Any file type
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-gray-700/50 rounded-xl p-4 bg-gray-800/30 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Title
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 text-white focus:border-[var(--accent-teal-border)] outline-none transition-colors"
              placeholder="My Amazing Digital Asset"
            />
          </div>

          {/* Description Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 text-white focus:border-[var(--accent-teal-border)] outline-none transition-colors resize-none"
              placeholder="What makes this asset special?"
            />
          </div>

          {/* Price Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Price
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 z-10" />
              <input 
                type="number" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 pl-10 pr-32 text-white focus:border-[var(--accent-teal-border)] outline-none transition-colors"
                placeholder="0.1"
                step="0.01"
                min="0.001"
              />
              {/* Custom Plus/Minus Buttons - Sui-style Integration */}
              <div className="absolute right-0 top-0 bottom-0 flex flex-col w-16">
                <button
                  type="button"
                  onClick={incrementPrice}
                  className="flex-1 flex items-center justify-center bg-gray-800/80 backdrop-blur-md hover:bg-gradient-to-br hover:from-purple-500/50 hover:to-teal-500/50 border-l border-gray-600/50 hover:border-[var(--accent-teal-border)] rounded-tr-xl transition-all duration-200 group active:opacity-70"
                >
                  <Plus className="w-5 h-5 text-gray-300 group-hover:text-[var(--accent-teal)] transition-colors" />
                </button>
                <div className="h-px bg-gray-600/50"></div>
                <button
                  type="button"
                  onClick={decrementPrice}
                  className="flex-1 flex items-center justify-center bg-gray-800/80 backdrop-blur-md hover:bg-gradient-to-br hover:from-purple-500/50 hover:to-teal-500/50 border-l border-gray-600/50 hover:border-[var(--accent-teal-border)] rounded-br-xl transition-all duration-200 group active:opacity-70"
                >
                  <Minus className="w-5 h-5 text-gray-300 group-hover:text-[var(--accent-teal)] transition-colors" />
                </button>
              </div>
              <span className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm pointer-events-none">
                SUI
              </span>
            </div>
          </div>

          {/* Affiliate Toggle - Perfect Alignment & Structural Integrity */}
          <div className="mb-6 p-4 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Users className="w-4 h-4 text-purple-400 shrink-0 flex-shrink-0" />
                <label 
                  htmlFor="affiliate-toggle" 
                  className="text-sm font-medium text-gray-300 cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  Enable Affiliate Program
                </label>
              </div>
              <div className="flex-shrink-0 flex items-center">
                <button
                  id="affiliate-toggle"
                  onClick={() => setEnableAffiliate(!enableAffiliate)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 overflow-hidden flex items-center ${
                    enableAffiliate 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30' 
                      : 'bg-gray-600'
                  }`}
                  aria-label="Toggle affiliate program"
                  type="button"
                >
                  <span 
                    className={`absolute w-5 h-5 bg-white rounded-full transition-all duration-300 ease-in-out shadow-md ${
                      enableAffiliate ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
                    }`}
                    style={{
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  />
                </button>
              </div>
            </div>
            
            {enableAffiliate && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-700/50">
                <Percent className="w-4 h-4 text-gray-500 shrink-0 self-center" />
                <div className="relative shrink-0">
                  <input
                    type="number"
                    value={affiliatePercentage}
                    onChange={(e) => setAffiliatePercentage(e.target.value)}
                    min="1"
                    max="10"
                    className="w-20 h-9 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white text-center focus:border-[var(--accent-teal-border)] outline-none transition-colors pr-12"
                  />
                  {/* Custom Plus/Minus Buttons - Matching Price Input Style */}
                  <div className="absolute right-0 top-0 bottom-0 flex flex-col w-12">
                    <button
                      type="button"
                      onClick={incrementAffiliatePercentage}
                      className="flex-1 flex items-center justify-center bg-gray-700/80 backdrop-blur-md hover:bg-gradient-to-br hover:from-purple-500/50 hover:to-teal-500/50 border-l border-gray-600/50 hover:border-[var(--accent-teal-border)] rounded-tr-lg transition-all duration-200 group active:opacity-70"
                    >
                      <Plus className="w-4 h-4 text-gray-300 group-hover:text-[var(--accent-teal)] transition-colors" />
                    </button>
                    <div className="h-px bg-gray-600/50"></div>
                    <button
                      type="button"
                      onClick={decrementAffiliatePercentage}
                      className="flex-1 flex items-center justify-center bg-gray-700/80 backdrop-blur-md hover:bg-gradient-to-br hover:from-purple-500/50 hover:to-teal-500/50 border-l border-gray-600/50 hover:border-[var(--accent-teal-border)] rounded-br-lg transition-all duration-200 group active:opacity-70"
                    >
                      <Minus className="w-4 h-4 text-gray-300 group-hover:text-[var(--accent-teal)] transition-colors" />
                    </button>
                  </div>
                </div>
                <span className="text-sm text-gray-400 flex-1 min-w-0 self-center">% commission for referrers (max 10%)</span>
              </div>
            )}
          </div>

          {/* Submit Button - Fixed Placement (No Shift) */}
          <button
            onClick={handleCreateListing}
            disabled={!currentAccount || isLoading || !file || !title || !price}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
              currentAccount && !isLoading && file && title && price
                ? 'btn-primary active:opacity-90' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {loadingStep || "Processing..."}
              </>
            ) : !currentAccount ? (
              'Connect Wallet to Start'
            ) : !file ? (
              'Upload a File'
            ) : !title ? (
              'Enter a Title'
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create Paywall Link
              </>
            )}
          </button>
        </div>

        {/* Success Area */}
        {generatedLink && (
          <div className="mt-6 p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-emerald-400 font-bold text-lg">Listing Created!</h3>
                <p className="text-sm text-gray-400">Stored on Walrus Decentralized Grid 🦭</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Price:</span>
                <span className="font-bold text-white">{price} SUI</span>
                {enableAffiliate && (
                  <span className="text-xs text-violet-400">({affiliatePercentage}% affiliate)</span>
                )}
              </div>
              
              {blobId && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Walrus Blob:</span>
                  <a 
                    href={getWalrusExplorerUrl(blobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    {blobId.slice(0, 16)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              
              {txDigest && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">TX:</span>
                  <a 
                    href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    {txDigest.slice(0, 16)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Main Link Display - Glow-Edged Glass Panel with Custom Scrollbar */}
            <div className="glass-card p-4 mb-4 border-[var(--accent-teal-border)]/30 shadow-[0_0_20px_rgba(0,246,255,0.1)]">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                <span>🔗</span>
                <span>Paywall Link</span>
              </p>
              <div className="text-xs break-all font-mono text-purple-300 max-h-20 overflow-y-auto bg-black/20 p-3 rounded-lg custom-scrollbar">
                {generatedLink}
              </div>
            </div>
            
            {/* Copy Button - Primary Gradient */}
            <button 
              onClick={copyLink}
              className="btn-primary w-full mb-3"
            >
              {linkCopied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Paywall Link
                </>
              )}
            </button>

            {/* Affiliate Link (if enabled) - Special Styling */}
            {affiliateLink && (
              <>
                <div className="p-4 rounded-xl border-2 border-[var(--accent-teal-border)]/50 mb-4 bg-gradient-to-br from-teal-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm shadow-[0_0_30px_rgba(0,246,255,0.2)] relative overflow-hidden">
                  {/* Animated Sparkles Icon */}
                  <div className="absolute top-2 right-2">
                    <Sparkles className="w-5 h-5 text-[var(--accent-teal)] animate-pulse" />
                  </div>
                  
                  <p className="text-sm font-semibold text-[var(--accent-teal)] mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Affiliate Link</span>
                  </p>
                  
                  <p className="text-xs text-gray-300 mb-3 font-medium">
                    Share this link and earn {affiliatePercentage}% passive income!
                  </p>
                  
                  <div className="text-xs break-all font-mono text-teal-300 max-h-16 overflow-y-auto bg-black/30 p-3 rounded-lg border border-teal-500/20 custom-scrollbar">
                    {affiliateLink}
                  </div>
                </div>
                
                <button 
                  onClick={copyAffiliateLink}
                  className="w-full py-3 bg-gradient-to-r from-teal-600/20 to-purple-600/20 hover:from-teal-600/30 hover:to-purple-600/30 border border-[var(--accent-teal-border)]/50 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm text-white hover:shadow-[0_0_20px_rgba(0,246,255,0.3)] active:scale-[0.98]"
                >
                  {affiliateLinkCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Affiliate Link Copied!
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Copy Affiliate Link
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🦭 Stored on Walrus Decentralized Grid • 🔒 AES-256-GCM Encrypted</p>
          <p className="mt-1">💸 Instant P2P payment • 🔑 Key never leaves your link</p>
        </div>
      </div>
    </div>
    </>
  );
}
