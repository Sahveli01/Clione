/**
 * Crypto utilities for Sui-Unlock
 * Uses Web Crypto API for AES-GCM encryption
 */

// ============ Key Generation ============

/**
 * Generates a random AES-GCM encryption key
 * @returns CryptoKey for encryption/decryption
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable - so we can export it
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey to a base64 string for URL sharing
 * @param key - The CryptoKey to export
 * @returns Base64 encoded key string
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyBytes = new Uint8Array(rawKey);
  return btoa(String.fromCharCode(...keyBytes));
}

/**
 * Imports a base64 encoded key string back to CryptoKey
 * @param base64Key - Base64 encoded key string
 * @returns CryptoKey for decryption
 */
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

// ============ File Encryption ============

/**
 * Encrypts a file using AES-GCM
 * @param file - The file to encrypt
 * @param key - The CryptoKey to use for encryption
 * @returns Object containing encrypted blob and IV
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: Uint8Array; originalName: string; originalType: string }> {
  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the file content
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as Uint8Array<ArrayBuffer>,
    },
    key,
    fileBuffer
  );
  
  // Create blob from encrypted data
  const encryptedBlob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
  
  return {
    encryptedBlob,
    iv,
    originalName: file.name,
    originalType: file.type,
  };
}

/**
 * Decrypts an encrypted blob using AES-GCM
 * @param encryptedData - The encrypted data as ArrayBuffer
 * @param key - The CryptoKey to use for decryption
 * @param iv - The initialization vector used during encryption
 * @param originalName - Original file name
 * @param originalType - Original MIME type
 * @returns Decrypted File object
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  originalName: string,
  originalType: string
): Promise<File> {
  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv) as Uint8Array<ArrayBuffer>,
    },
    key,
    encryptedData
  );
  
  // Create File from decrypted data
  const decryptedBlob = new Blob([decryptedBuffer], { type: originalType });
  return new File([decryptedBlob], originalName, { type: originalType });
}

// ============ Metadata Encoding ============

/**
 * Creates a combined payload with IV and encrypted data
 * Format: [12 bytes IV][encrypted data]
 */
export function createEncryptedPayload(encryptedBlob: Blob, iv: Uint8Array): Promise<Blob> {
  return new Promise(async (resolve) => {
    const encryptedBuffer = await encryptedBlob.arrayBuffer();
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    resolve(new Blob([combined], { type: "application/octet-stream" }));
  });
}

/**
 * Extracts IV and encrypted data from combined payload
 * @param payload - The combined payload (IV + encrypted data)
 * @returns Object with IV and encrypted data
 */
export function parseEncryptedPayload(payload: ArrayBuffer): { iv: Uint8Array; encryptedData: ArrayBuffer } {
  const payloadBytes = new Uint8Array(payload);
  const iv = payloadBytes.slice(0, 12);
  const encryptedData = payloadBytes.slice(12).buffer;
  return { iv, encryptedData };
}

// ============ URL Key Handling ============

/**
 * Encodes file metadata + key into a URL-safe string
 * Format: base64(JSON({ key, name, type }))
 */
export async function encodeUnlockData(
  key: CryptoKey,
  fileName: string,
  fileType: string
): Promise<string> {
  const keyBase64 = await exportKeyToBase64(key);
  const data = JSON.stringify({
    k: keyBase64,
    n: fileName,
    t: fileType,
  });
  return btoa(data);
}

/**
 * Decodes unlock data from URL fragment
 * @param encoded - The encoded unlock data string
 * @returns Object with key, file name, and file type
 */
export async function decodeUnlockData(encoded: string): Promise<{
  key: CryptoKey;
  fileName: string;
  fileType: string;
}> {
  try {
    const data = JSON.parse(atob(encoded));
    const key = await importKeyFromBase64(data.k);
    return {
      key,
      fileName: data.n,
      fileType: data.t,
    };
  } catch (error) {
    throw new Error("Invalid unlock key - the link may be corrupted");
  }
}

// ============ Legacy Functions (Preserved for compatibility) ============

import CryptoJS from 'crypto-js';

/**
 * Encrypts data using AES encryption with the provided passphrase
 * @deprecated Use encryptFile for file encryption
 */
export function encryptData(data: string, passphrase: string): string {
  const encrypted = CryptoJS.AES.encrypt(data, passphrase).toString();
  return encrypted;
}

/**
 * Decrypts data using AES decryption with the provided passphrase
 * @deprecated Use decryptFile for file decryption
 */
export function decryptData(ciphertext: string, passphrase: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, passphrase);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!plaintext) {
      throw new Error('Decryption failed: Invalid passphrase or corrupted data');
    }
    
    return plaintext;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============ Download Helper ============

/**
 * Triggers a file download in the browser
 * @param file - The file to download
 */
export function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
