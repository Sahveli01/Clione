import {
  SuiClient,
  getFullnodeUrl,
  SuiTransactionBlockResponse,
  SuiObjectChange,
} from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromHEX } from "@mysten/sui.js/utils";

export const SUI_NETWORK =
  process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";

export const SUI_CLIENT = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK as "testnet" | "mainnet" | "devnet"),
});

/**
 * Creates a keypair from a private key hex string
 */
export function getKeypairFromPrivateKey(
  privateKeyHex: string
): Ed25519Keypair {
  const privateKeyBytes = fromHEX(privateKeyHex);
  return Ed25519Keypair.fromSecretKey(privateKeyBytes);
}

/**
 * Estimates gas cost for a transaction
 * Returns gas cost in MIST (1 SUI = 1,000,000,000 MIST)
 * 
 * Note: This uses a simplified estimation. For accurate gas costs,
 * you should dry-run the transaction using SUI_CLIENT.dryRunTransactionBlock
 */
export async function estimateGasCost(
  txb: TransactionBlock
): Promise<bigint> {
  try {
    // Attempt to dry-run for accurate estimation
    // Note: This requires the transaction to be properly constructed
    // For now, we'll use a conservative estimate
    const baseGas = BigInt(1000); // Base transaction cost
    const perObjectGas = BigInt(100); // Per object touched
    const estimatedGas = baseGas + perObjectGas * BigInt(5); // Conservative estimate for swap + transfers
    
    // Add buffer for safety (20% buffer)
    return (estimatedGas * BigInt(120)) / BigInt(100);
  } catch (error) {
    // Fallback to conservative estimate if dry-run fails
    console.warn("Gas estimation failed, using fallback:", error);
    return BigInt(2000); // Fallback: 2000 MIST
  }
}

/**
 * Converts MIST to SUI
 */
export function mistToSui(mist: bigint | string): number {
  const mistBigInt = typeof mist === "string" ? BigInt(mist) : mist;
  return Number(mistBigInt) / 1_000_000_000;
}

/**
 * Converts SUI to MIST
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.floor(sui * 1_000_000_000));
}

/**
 * Formats an address for display (first 6 + last 4 chars)
 */
export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validates a Sui address format
 */
export function isValidSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * Validates a Sui object ID format (same as address format)
 */
export function isValidObjectId(objectId: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(objectId);
}

/**
 * Extracts a created object ID from transaction results based on struct type.
 * 
 * This function parses the `objectChanges` array from a transaction response
 * to find objects that were created and match the specified struct type.
 * 
 * @param txResult - The transaction response from signAndExecuteTransactionBlock
 * @param structType - The full struct type to match (e.g., "0x123::zk_drop::ZkDrop")
 *                    Can also be a partial match like "zk_drop::ZkDrop"
 * @returns The object ID of the first matching created object, or null if not found
 * 
 * @example
 * const result = await signAndExecuteTransaction({ transactionBlock: tx });
 * const dropId = getCreatedObjectId(result, "zk_drop::ZkDrop");
 * // Returns: "0xabc123..." or null
 */
export function getCreatedObjectId(
  txResult: SuiTransactionBlockResponse,
  structType: string
): string | null {
  // Check if objectChanges exists in the response
  if (!txResult.objectChanges || !Array.isArray(txResult.objectChanges)) {
    console.warn("getCreatedObjectId: No objectChanges in transaction result");
    return null;
  }

  // Find created objects matching the struct type
  for (const change of txResult.objectChanges) {
    // Only look at 'created' objects
    if (change.type === "created") {
      const createdChange = change as SuiObjectChange & { 
        type: "created"; 
        objectType: string; 
        objectId: string;
      };
      
      // Check if the objectType contains the struct type
      // This handles both full type (0x123::module::Struct) and partial (module::Struct)
      if (createdChange.objectType && createdChange.objectType.includes(structType)) {
        console.log(`getCreatedObjectId: Found matching object - Type: ${createdChange.objectType}, ID: ${createdChange.objectId}`);
        return createdChange.objectId;
      }
    }
  }

  console.warn(`getCreatedObjectId: No created object found matching type "${structType}"`);
  return null;
}

/**
 * Extracts all created object IDs from transaction results.
 * Useful for debugging or when you need to find multiple created objects.
 * 
 * @param txResult - The transaction response
 * @returns Array of { objectId, objectType } for all created objects
 */
export function getAllCreatedObjects(
  txResult: SuiTransactionBlockResponse
): Array<{ objectId: string; objectType: string }> {
  if (!txResult.objectChanges || !Array.isArray(txResult.objectChanges)) {
    return [];
  }

  const createdObjects: Array<{ objectId: string; objectType: string }> = [];

  for (const change of txResult.objectChanges) {
    if (change.type === "created") {
      const createdChange = change as SuiObjectChange & { 
        type: "created"; 
        objectType: string; 
        objectId: string;
      };
      
      if (createdChange.objectId && createdChange.objectType) {
        createdObjects.push({
          objectId: createdChange.objectId,
          objectType: createdChange.objectType,
        });
      }
    }
  }

  return createdObjects;
}

/**
 * Fetches details about a Listing object from the chain
 * 
 * @param objectId - The Listing object ID
 * @returns Listing details or null if not found
 */
export async function getListingDetails(objectId: string): Promise<{
  id: string;
  seller: string;
  price: string;
  ipfsCid: string;
  name: string;
  description: string;
  isActive: boolean;
} | null> {
  try {
    const object = await SUI_CLIENT.getObject({
      id: objectId,
      options: {
        showContent: true,
        showOwner: true,
      },
    });

    if (!object.data || !object.data.content) {
      return null;
    }

    const content = object.data.content as unknown as {
      dataType: string;
      type: string;
      fields: {
        seller: string;
        price: string;
        ipfs_cid: number[];
        name: number[];
        description: number[];
        is_active: boolean;
      };
    };

    if (content.dataType !== "moveObject") {
      return null;
    }

    const decoder = new TextDecoder();

    return {
      id: objectId,
      seller: content.fields.seller || "",
      price: content.fields.price || "0",
      ipfsCid: decoder.decode(new Uint8Array(content.fields.ipfs_cid || [])),
      name: decoder.decode(new Uint8Array(content.fields.name || [])),
      description: decoder.decode(new Uint8Array(content.fields.description || [])),
      isActive: content.fields.is_active ?? true,
    };
  } catch (error) {
    console.error("Failed to fetch Listing details:", error);
    return null;
  }
}
