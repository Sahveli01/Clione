/**
 * IPFS utilities for Sui-Unlock
 * Currently uses mock implementation - can be replaced with real IPFS later
 */

// Mock storage for development (simulates IPFS)
const mockStorage = new Map<string, Blob>();

/**
 * Generates a mock IPFS CID
 * In production, this would be the actual CID from IPFS
 */
function generateMockCID(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let hash = '';
  for (let i = 0; i < 46; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Qm${hash}`;
}

/**
 * Uploads an encrypted blob to IPFS (Mock implementation)
 * 
 * @param encryptedBlob - The encrypted file blob
 * @returns The IPFS CID
 * 
 * TODO: Replace with real IPFS implementation:
 * - web3.storage
 * - Pinata
 * - nft.storage
 * - Local IPFS node
 */
export async function uploadToIPFS(encryptedBlob: Blob): Promise<string> {
  // Generate mock CID
  const cid = generateMockCID();
  
  // Store in memory (mock)
  mockStorage.set(cid, encryptedBlob);
  
  console.log(`📦 [IPFS Mock] Uploaded file, CID: ${cid}`);
  console.log(`   Size: ${(encryptedBlob.size / 1024).toFixed(2)} KB`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return cid;
}

/**
 * Downloads a file from IPFS (Mock implementation)
 * 
 * @param cid - The IPFS CID
 * @returns The file as ArrayBuffer
 */
export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  console.log(`📥 [IPFS Mock] Downloading file, CID: ${cid}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Check mock storage first
  const storedBlob = mockStorage.get(cid);
  if (storedBlob) {
    console.log(`   Found in mock storage`);
    return await storedBlob.arrayBuffer();
  }
  
  // If not in mock storage, this is a real CID from a previous session
  // In production, we would fetch from IPFS gateway
  // For now, throw an error or return mock data
  
  // Try public gateway (for real IPFS CIDs)
  try {
    const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
    if (response.ok) {
      console.log(`   Fetched from IPFS gateway`);
      return await response.arrayBuffer();
    }
  } catch (error) {
    console.warn(`   Failed to fetch from IPFS gateway`);
  }
  
  throw new Error(`File not found: ${cid}`);
}

/**
 * Gets the IPFS gateway URL for a CID
 * @param cid - The IPFS CID
 * @returns Gateway URL
 */
export function getIPFSGatewayURL(cid: string): string {
  return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Validates an IPFS CID format
 * @param cid - The CID to validate
 * @returns boolean
 */
export function isValidCID(cid: string): boolean {
  // Basic validation for CIDv0 (Qm...) and CIDv1 (bafy...)
  return /^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,})$/.test(cid);
}

