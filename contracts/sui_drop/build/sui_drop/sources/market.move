module sui_drop::market;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::event;

/// Error codes
const E_INSUFFICIENT_PAYMENT: u64 = 0;
const E_LISTING_NOT_ACTIVE: u64 = 1;
const E_INVALID_AFFILIATE_PERCENTAGE: u64 = 2;
const E_CANNOT_SELF_REFER: u64 = 3;

/// Maximum affiliate percentage (10% = 1000 basis points)
const MAX_AFFILIATE_PERCENTAGE: u64 = 1000;
/// Basis points denominator (100% = 10000)
const BASIS_POINTS: u64 = 10000;

/// Event emitted when a purchase is made
public struct PurchaseEvent has copy, drop {
    listing_id: ID,
    buyer: address,
    seller: address,
    price: u64,
}

/// Event emitted when a purchase is made with affiliate
public struct AffiliatePurchaseEvent has copy, drop {
    listing_id: ID,
    buyer: address,
    seller: address,
    referrer: address,
    price: u64,
    affiliate_fee: u64,
    seller_amount: u64,
}

/// A digital asset listing - shared object so anyone can purchase
public struct Listing has key, store {
    id: UID,
    /// The seller's address (receives payment)
    seller: address,
    /// Price in MIST (1 SUI = 1,000,000,000 MIST)
    price: u64,
    /// Walrus Blob ID of the encrypted file
    blob_id: vector<u8>,
    /// Name of the digital asset
    name: vector<u8>,
    /// Description of the asset
    description: vector<u8>,
    /// Whether the listing is active
    is_active: bool,
    /// Affiliate percentage in basis points (e.g., 1000 = 10%)
    affiliate_percentage: u64,
}

/// Creates a new listing for a digital asset
/// The encryption key is NOT stored on-chain (stays in the URL)
public entry fun create_listing(
    price: u64,
    blob_id: vector<u8>,
    name: vector<u8>,
    description: vector<u8>,
    ctx: &mut TxContext
) {
    create_listing_with_affiliate(price, blob_id, name, description, 0, ctx)
}

/// Creates a new listing with affiliate percentage
/// @param affiliate_percentage - Percentage in basis points (e.g., 1000 = 10%, max 1000)
public entry fun create_listing_with_affiliate(
    price: u64,
    blob_id: vector<u8>,
    name: vector<u8>,
    description: vector<u8>,
    affiliate_percentage: u64,
    ctx: &mut TxContext
) {
    // Validate affiliate percentage (max 10%)
    assert!(affiliate_percentage <= MAX_AFFILIATE_PERCENTAGE, E_INVALID_AFFILIATE_PERCENTAGE);
    
    let seller = tx_context::sender(ctx);
    
    let listing = Listing {
        id: object::new(ctx),
        seller,
        price,
        blob_id,
        name,
        description,
        is_active: true,
        affiliate_percentage,
    };
    
    // Share the listing so anyone can purchase
    transfer::share_object(listing);
}

/// Purchase a digital asset (no referral)
/// Payment goes directly to the seller (P2P, no intermediary)
public entry fun purchase(
    listing: &Listing,
    payment: Coin<SUI>,
    ctx: &mut TxContext
) {
    // Verify listing is active
    assert!(listing.is_active, E_LISTING_NOT_ACTIVE);
    
    // Verify payment amount
    let payment_value = coin::value(&payment);
    assert!(payment_value >= listing.price, E_INSUFFICIENT_PAYMENT);
    
    let buyer = tx_context::sender(ctx);
    
    // Transfer payment directly to seller
    transfer::public_transfer(payment, listing.seller);
    
    // Emit purchase event
    event::emit(PurchaseEvent {
        listing_id: object::id(listing),
        buyer,
        seller: listing.seller,
        price: listing.price,
    });
}

/// Purchase a digital asset with affiliate referral
/// Splits payment between seller and referrer based on affiliate_percentage
public entry fun purchase_with_referral(
    listing: &Listing,
    mut payment: Coin<SUI>,
    referrer: address,
    ctx: &mut TxContext
) {
    // Verify listing is active
    assert!(listing.is_active, E_LISTING_NOT_ACTIVE);
    
    // Verify payment amount
    let payment_value = coin::value(&payment);
    assert!(payment_value >= listing.price, E_INSUFFICIENT_PAYMENT);
    
    let buyer = tx_context::sender(ctx);
    
    // Prevent self-referral
    assert!(referrer != buyer, E_CANNOT_SELF_REFER);
    assert!(referrer != listing.seller, E_CANNOT_SELF_REFER);
    
    // Calculate affiliate fee
    let affiliate_fee = if (listing.affiliate_percentage > 0) {
        (listing.price * listing.affiliate_percentage) / BASIS_POINTS
    } else {
        0
    };
    
    let seller_amount = listing.price - affiliate_fee;
    
    // Split payment if there's an affiliate fee
    if (affiliate_fee > 0) {
        // Split coin for affiliate
        let affiliate_coin = coin::split(&mut payment, affiliate_fee, ctx);
        transfer::public_transfer(affiliate_coin, referrer);
    };
    
    // Transfer remaining to seller
    transfer::public_transfer(payment, listing.seller);
    
    // Emit affiliate purchase event
    event::emit(AffiliatePurchaseEvent {
        listing_id: object::id(listing),
        buyer,
        seller: listing.seller,
        referrer,
        price: listing.price,
        affiliate_fee,
        seller_amount,
    });
}

/// Deactivate a listing (only seller can do this)
public entry fun deactivate_listing(
    listing: &mut Listing,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == listing.seller, 1);
    listing.is_active = false;
}

/// Reactivate a listing (only seller can do this)
public entry fun reactivate_listing(
    listing: &mut Listing,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == listing.seller, 1);
    listing.is_active = true;
}

/// Update affiliate percentage (only seller can do this)
public entry fun update_affiliate_percentage(
    listing: &mut Listing,
    new_percentage: u64,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == listing.seller, 1);
    assert!(new_percentage <= MAX_AFFILIATE_PERCENTAGE, E_INVALID_AFFILIATE_PERCENTAGE);
    listing.affiliate_percentage = new_percentage;
}

// ============ View Functions ============

/// View function: Get listing price
public fun get_price(listing: &Listing): u64 {
    listing.price
}

/// View function: Get seller address
public fun get_seller(listing: &Listing): address {
    listing.seller
}

/// View function: Check if listing is active
public fun is_active(listing: &Listing): bool {
    listing.is_active
}

/// View function: Get Walrus Blob ID
public fun get_blob_id(listing: &Listing): vector<u8> {
    listing.blob_id
}

/// View function: Get name
public fun get_name(listing: &Listing): vector<u8> {
    listing.name
}

/// View function: Get description
public fun get_description(listing: &Listing): vector<u8> {
    listing.description
}

/// View function: Get affiliate percentage
public fun get_affiliate_percentage(listing: &Listing): u64 {
    listing.affiliate_percentage
}

/// View function: Calculate affiliate fee for a purchase
public fun calculate_affiliate_fee(listing: &Listing): u64 {
    (listing.price * listing.affiliate_percentage) / BASIS_POINTS
}

