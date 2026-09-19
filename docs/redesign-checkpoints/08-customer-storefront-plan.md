# Checkpoint 08: Customer Storefront Redesign Plan & Specification

- **Checkpoint ID**: `CP-08-STOREFRONT`
- **Date**: 2026-09-11
- **Current Phase**: Phase 4 (Customer Storefront Experience)
- **Status**: `PRODUCTION-READY (CURRENT ARCHITECTURE)`
- **Risk Level**: Low

---

## 1. Executive Summary

The customer-facing storefront embodies CakeToHome's brand anchor: **Royal Patisserie Navy (`#1D2F5D`)** paired with warm cream, gallery white, and antique gold accents. Every visual layer is optimized for emotional gifting, sensory luxury, high conversion, and zero-friction checkout.

All product attributes, prices, stock levels, GST calculations, and branch delivery boundaries are 100% server-authoritative from PostgreSQL.

---

## 2. Customer Journey & Page-by-Page Experience

### 2.1 Homepage (`/`)
- **Engine**: Powered by `PageRenderer.tsx` and configured via `cmspg_home`.
- **Hero Experience**: 22-frame desktop canvas scrubbing engine (`ScrollFrameHero`) with automated high-DPI preloader. On mobile/touch viewports, gracefully transitions to a single responsive hero card.
- **Section Flow**:
  1. Announcement Banner: Real-time active promotions and same-day delivery alerts.
  2. Primary Header: Pincode switcher, occasion quick-links, debounced search, wishlist, and cart counter.
  3. ScrollFrameHero: Artisanal confectionery showcase.
  4. Category Showcase: Visual category circles/cards (Signature Cakes, Cheesecakes, Pastries, Hampers).
  5. Occasion Tiles: High-intent filters (Birthday, Anniversary, Romantic, Kids, Wedding).
  6. Bestsellers Rail: Live database-backed products with ratings, weight pills, and price badges.
  7. 4-Pillar Trust Grid: "100% Freshly Baked", "FSSAI Food-Safe", "Free Same-Day Delivery", "Artisanal Recipes".
  8. Customer Reviews & UGC: Verified buyer testimonials with star ratings.
  9. Editorial Baker’s Story: Craftsmanship heritage with subtle antique gold borders.
  10. FAQ Accordion & Newsletter Club: Common delivery/dietary queries + VIP email capture.
  11. Royal Patisserie Footer: Branch directory, legal links, FSSAI licence badge, and payment badges.

### 2.2 Product Listing & Category Pages (`/products`, `/categories/[slug]`, `/occasions/[slug]`)
- **Filters**: Flavour, weight (0.5kg, 1kg, 2kg+), dietary preference (Eggless, Gluten-Free, Vegan, Sugar-Free), price range, and occasion.
- **Mobile Drawer**: Slide-over filter drawer with instantaneous result counts.
- **Card Hierarchy**: High-res photography, dietary badge (green veg dot / eggless tag), star rating, starting price, and "View Cake" CTA.

### 2.3 Product Detail Page (PDP - `/products/[slug]`)
- **PIM-Controlled**: All fields (weights, flavours, shapes, fillings, dietary options, accessories) are dynamically rendered from PIM configuration.
- **Dynamic Price Engine**: Formula: `Base Weight Price + Shape Modifier + Flavour Modifier + Add-ons`. Updates in real time without page reload.
- **Cake Message Protocol**:
  - Optional message input with live 40-character countdown.
  - If empty or whitespace-only on "Add to Cart", prompts confirmation modal:
    - `[✍️ Add Message]`: Scrolls to and focuses input.
    - `[Continue →]`: Adds to cart without message.
  - Cart is never mutated prior to customer confirmation.
  - `isSubmittingRef` lock strictly prevents duplicate submissions.

### 2.4 Cart & Checkout Funnel (`/cart`, `/checkout`)
- **Cart Summary**: Exact item snapshots, selected variant, message preview, and selected add-ons.
- **Server-Authoritative Totals**: Cart calculations occur server-side (`subtotal`, `delivery_fee`, `cgst`, `sgst`, `discount`, `grand_total`).
- **Pincode Validation**: Validates target pincode against active branches before allowing order placement.
- **Delivery Slot Selector**: Standard (10 AM - 7 PM), Same-Day Express, and Midnight (11 PM - 12 AM).
- **Payment Gateway**: Seamless integration with Razorpay / UPI / Card / COD with replay-proof idempotency keys.

### 2.5 Post-Purchase Experience (`/order/success/[id]`, `/track/[id]`)
- **Durable Order Confirmation**: Displays order number, itemized invoice breakdown, delivery slot, and live KOT preparation status.
- **Driver Tracking**: Live map and OTP verification for delivery handover.
- **Customer Account (`/account`)**: Order history reflects the exact same PostgreSQL record seen by admin staff.
