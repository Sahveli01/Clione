/**
 * Walrus Protocol Utilities
 * 
 * Walrus is a decentralized storage protocol on Sui Network.
 * This module handles uploading and downloading encrypted files to/from Walrus.
 * 
 * @see https://docs.walrus.site/
 */

// Walrus endpoints from environment variables
const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER || "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";

// Default storage duration in epochs (1 epoch ≈ 1 day on testnet)
const DEFAULT_EPOCHS = 5;

/**
 * Response type from Walrus store endpoint (/v1/blobs)
 * Updated according to Walrus Protocol API documentation
 */
interface WalrusStoreResponse {
  newlyCreated?: {
    blobObject: {
      blobId: string;
      storage: {
        id: string;
        startEpoch?: number;
        endEpoch?: number;
        storageSize?: number;
      };
      // Additional fields that may be present
      id?: string;
      storedEpoch?: number;
      size?: number;
      erasureCodeType?: string;
      certifiedEpoch?: number;
    };
    cost: number;
    encodedSize?: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: {
      txDigest: string;
      eventSeq: string;
    };
    endEpoch?: number;
  };
}

/**
 * Upload an encrypted file to Walrus Protocol
 * 
 * @param encryptedBlob - The encrypted file data as a Blob
 * @param epochs - Number of epochs to store the file (default: 5)
 * @returns The Walrus Blob ID for retrieval
 * @throws Error if upload fails
 * 
 * @example
 * const blobId = await uploadToWalrus(encryptedBlob);
 * console.log("Stored on Walrus:", blobId);
 */
export async function uploadToWalrus(
  encryptedBlob: Blob,
  epochs: number = DEFAULT_EPOCHS
): Promise<string> {
  console.log("🦭 Uploading to Walrus...");
  console.log("   Publisher:", WALRUS_PUBLISHER);
  console.log("   File size:", encryptedBlob.size, "bytes");
  console.log("   Storage duration:", epochs, "epochs");

  try {
    // Updated endpoint: /v1/store is deprecated, use /v1/blobs
    const response = await fetch(
      `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`,
      {
        method: "PUT",
        body: encryptedBlob,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Walrus upload failed:", response.status, errorText);
      throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
    }

    const result: WalrusStoreResponse = await response.json();
    console.log("🦭 Walrus response:", result);

    // Handle both newly created and already certified cases
    // According to docs: Check alreadyCertified first, then newlyCreated
    let blobId: string | null = null;
    
    if (result.alreadyCertified) {
      // Case 2: Blob already exists and is certified
      blobId = result.alreadyCertified.blobId;
      console.log("✅ Blob already exists on Walrus");
      console.log("   Blob ID:", blobId);
      console.log("   Valid until epoch:", result.alreadyCertified.endEpoch);
      console.log("   TX Digest:", result.alreadyCertified.event.txDigest);
    } else if (result.newlyCreated) {
      // Case 1: New blob was created
      blobId = result.newlyCreated.blobObject.blobId;
      console.log("✅ New blob created on Walrus");
      console.log("   Blob ID:", blobId);
      console.log("   Size:", result.newlyCreated.blobObject.size, "bytes");
      console.log("   Cost:", result.newlyCreated.cost, "MIST");
      if (result.newlyCreated.blobObject.storage) {
        console.log("   Storage until epoch:", result.newlyCreated.blobObject.storage.endEpoch);
      }
    }

    if (!blobId) {
      throw new Error("Unexpected Walrus response format: neither 'alreadyCertified' nor 'newlyCreated' found");
    }

    return blobId;
  } catch (error) {
    console.error("❌ Walrus upload error:", error);
    throw error;
  }
}

/**
 * Download a file from Walrus Protocol
 * 
 * @param blobId - The Walrus Blob ID to retrieve
 * @returns The file data as an ArrayBuffer (encrypted)
 * @throws Error if download fails or blob not found
 * 
 * @example
 * const encryptedData = await downloadFromWalrus(blobId);
 * const decryptedFile = await decryptFile(encryptedData, key, iv);
 */
export async function downloadFromWalrus(blobId: string): Promise<ArrayBuffer> {
  console.log("🦭 Downloading from Walrus...");
  console.log("   Aggregator:", WALRUS_AGGREGATOR);
  console.log("   Blob ID:", blobId);

  // Validate blobId
  if (!blobId || blobId.trim() === "") {
    console.error("❌ Empty blobId provided to downloadFromWalrus");
    throw new Error("Blob ID is empty. The listing may have been created before Walrus integration or the blob ID was not properly stored.");
  }

  try {
    // Updated endpoint: use /v1/blobs/<blobId> instead of /v1/<blobId>
    const url = `${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`;
    console.log("   Full URL:", url);
    
    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("File not found on Walrus. It may have expired or the Blob ID is invalid.");
      }
      const errorText = await response.text();
      console.error("❌ Walrus download failed:", response.status, errorText);
      throw new Error(`Walrus download failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log("✅ Downloaded from Walrus");
    console.log("   Size:", arrayBuffer.byteLength, "bytes");

    return arrayBuffer;
  } catch (error) {
    console.error("❌ Walrus download error:", error);
    throw error;
  }
}

/**
 * Check if a blob exists on Walrus
 * 
 * @param blobId - The Walrus Blob ID to check
 * @returns True if the blob exists, false otherwise
 */
export async function checkBlobExists(blobId: string): Promise<boolean> {
  try {
    // Updated endpoint: use /v1/blobs/<blobId>
    const response = await fetch(
      `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`,
      {
        method: "HEAD",
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Walrus explorer URL for a blob
 * 
 * @param blobId - The Walrus Blob ID
 * @returns URL to view the blob on Walrus explorer
 */
export function getWalrusExplorerUrl(blobId: string): string {
  return `https://walruscan.com/testnet/blob/${blobId}`;
}

/**
 * Constants for external use
 */
export const WALRUS_CONFIG = {
  publisher: WALRUS_PUBLISHER,
  aggregator: WALRUS_AGGREGATOR,
  defaultEpochs: DEFAULT_EPOCHS,
};

