"use client";

import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { generateNonce, computeZkLoginAddress } from '@mysten/zklogin';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { jwtDecode } from 'jwt-decode';

const KEY_PAIR_SESSION_KEY = 'ephemeral_key';

export function setupEphemeralKey(): string {
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(KEY_PAIR_SESSION_KEY) : null;
  
  if (storedKey) {
    try {
      // FIX: Handle the case where storedKey is in Bech32 format (starts with suiprivkey...)
      // expected 32 bytes error happens when passing bech32 string directly to fromSecretKey without decoding
      let keypair;
      if (storedKey.startsWith('suiprivkey')) {
        const { secretKey } = decodeSuiPrivateKey(storedKey);
        keypair = Ed25519Keypair.fromSecretKey(secretKey);
      } else {
        // Fallback for raw hex - convert to Uint8Array
        const hexString = storedKey.startsWith('0x') ? storedKey.slice(2) : storedKey;
        const bytes = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        keypair = Ed25519Keypair.fromSecretKey(bytes); 
      }
      return keypair.getPublicKey().toSuiAddress();
    } catch (e) {
      console.warn("Invalid key format in storage, generating new one:", e);
      // If error, fall through to generate new key
    }
  }

  // Generate new key
  const keypair = new Ed25519Keypair();
  if (typeof window !== 'undefined') {
    // Save as the standard Bech32 string (suiprivkey...)
    localStorage.setItem(KEY_PAIR_SESSION_KEY, keypair.getSecretKey());
  }
  return keypair.getPublicKey().toSuiAddress();
}

export function getNonce(): string {
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(KEY_PAIR_SESSION_KEY) : null;
  if (!storedKey) throw new Error("Key not found. Setup ephemeral key first.");

  let keypair;
  if (storedKey.startsWith('suiprivkey')) {
     const { secretKey } = decodeSuiPrivateKey(storedKey);
     keypair = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
     // Convert hex string to Uint8Array
     const hexString = storedKey.startsWith('0x') ? storedKey.slice(2) : storedKey;
     const bytes = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
     keypair = Ed25519Keypair.fromSecretKey(bytes);
  }

  const maxEpoch = 2000; 
  
  // Randomness logic (Keep this as it was working to avoid bytes.reduce error)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomness = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')).toString();
  
  return generateNonce(keypair.getPublicKey(), maxEpoch, randomness);
}

export function getGoogleLoginUrl(): string {
  const nonce = getNonce();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/claim`;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Computes the zkLogin address from JWT and salt
 * @param jwt - The JWT token from Google OAuth
 * @param salt - The master salt (64 hex characters)
 * @returns The zkLogin address string
 */
export function computeZkAddress(jwt: string, salt: string): string {
  console.log("1. computeZkAddress started");
  console.log("   - Salt provided:", salt);
  
  try {
    if (!jwt || !salt) {
      console.error("   - Missing JWT or Salt");
      return "";
    }

    const decoded: any = jwtDecode(jwt);
    console.log("2. JWT Decoded:", decoded.sub, decoded.iss, decoded.aud);

    // FIX: Handle Salt format safely
    // If salt is hex (e.g. "a72..."), we need to add "0x" before BigInt
    const saltString = salt.startsWith('0x') ? salt : `0x${salt}`;
    console.log("3. Salt string for BigInt:", saltString);
    
    const saltBigInt = BigInt(saltString);
    console.log("4. Salt BigInt:", saltBigInt.toString());

    const address = computeZkLoginAddress({
      claimName: 'sub',
      claimValue: decoded.sub,
      aud: decoded.aud,
      iss: decoded.iss,
      userSalt: saltBigInt.toString(),
    });

    console.log("5. Address Computed:", address);
    return address;

  } catch (error) {
    console.error("CRITICAL ERROR in computeZkAddress:", error);
    return "Error: " + (error as Error).message;
  }
}

