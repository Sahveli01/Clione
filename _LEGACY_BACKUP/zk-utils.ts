import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { jwtDecode } from "jwt-decode";

export interface ZkLoginJwtPayload {
  iss: string; // Issuer (e.g., "https://accounts.google.com")
  sub: string; // Subject (user ID)
  email?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

/**
 * Computes the zkLogin address from JWT issuer, email, and master salt
 * Formula: Hash(JWT_Issuer + Receiver_Email + Master_Salt)
 */
export function computeZkLoginAddress(
  jwtIssuer: string,
  email: string,
  masterSalt: string
): string {
  const input = `${jwtIssuer}${email}${masterSalt}`;
  const hash = sha256(input);
  return `0x${bytesToHex(hash)}`;
}

/**
 * Decodes a JWT token and extracts the issuer
 */
export function getJwtIssuer(jwt: string): string {
  try {
    const decoded = jwtDecode<ZkLoginJwtPayload>(jwt);
    if (!decoded.iss) {
      throw new Error("JWT missing issuer (iss) claim");
    }
    return decoded.iss;
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error}`);
  }
}

/**
 * Extracts email from JWT token
 */
export function getEmailFromJwt(jwt: string): string {
  try {
    const decoded = jwtDecode<ZkLoginJwtPayload>(jwt);
    if (!decoded.email) {
      throw new Error("JWT missing email claim");
    }
    return decoded.email;
  } catch (error) {
    throw new Error(`Failed to extract email from JWT: ${error}`);
  }
}

/**
 * Generates a random master salt (32 bytes as hex string)
 */
export function generateMasterSalt(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return bytesToHex(array);
}

/**
 * Validates a master salt format (64 hex characters)
 */
export function isValidMasterSalt(salt: string): boolean {
  return /^[0-9a-f]{64}$/i.test(salt);
}

/**
 * Alias for generateMasterSalt - generates a random salt
 */
export function generateRandomSalt(): string {
  return generateMasterSalt();
}

/**
 * Computes zkLogin address from email and salt (uses Google as issuer)
 * This is a convenience wrapper for computeZkLoginAddress
 * 
 * NOTE: This uses a simplified hash method. For the real zkLogin address,
 * use computeZkAddress from lib/auth.ts which requires the JWT.
 */
export function getZkLoginAddress(email: string, salt: string): string {
  const googleIssuer = "https://accounts.google.com";
  return computeZkLoginAddress(googleIssuer, email, salt);
}

/**
 * Computes zkLogin address using the same method as getZkLoginAddress
 * This ensures consistency between generate and claim pages
 * @param email - The recipient email
 * @param salt - The master salt (64 hex characters)
 * @returns The computed address
 */
export function computeAddressFromEmailAndSalt(email: string, salt: string): string {
  return getZkLoginAddress(email, salt);
}

