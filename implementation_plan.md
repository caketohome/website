# CakeToHome — IDE Crash Recovery, UI Repair & Full-Stack Verification Plan

## Executive Summary

Following the IDE crash, a non-destructive recovery audit was completed. The repository is safe on branch `task/dev` (commit `3081621`), with 0 deleted files, 110 preserved modified files, clean TypeScript compilation (0 errors), and the Supabase PostgreSQL database fully intact and authoritative (57 products, 57 branches, 134 orders, 142 media assets).

During cold-boot inspection and Playwright browser diagnostics, key root causes behind previously reported visual anomalies were uncovered:
1. **Pizza Image Contamination:** All static fallback images in `frontend/public/images/` (`chocolate-cake.jpg`, `belgian-truffle.jpg`, `red-velvet-heart.jpg`, `strawberry-cake.jpg`, `placeholder-cake.jpg`, `default-cake.jpg`) were identical 208,771-byte photos of a Margherita pizza. This caused product listings, PDP placeholders, and popup previews to render pizza instead of cake.
2. **Storefront Inconsistencies & Dark-on-Dark Text:** The Product Detail Page (`product-detail-client.tsx`) wrapper was hardcoded with `bg-navy-surface` (`#0D152B`), causing child components using `text-gray-900` (e.g., Verified Customer Reviews heading in `product-reviews-section.tsx`) to render dark blue text on pitch dark navy, making them completely unreadable. In addition, PDP buttons used discordant rose/fuchsia (`bg-rosegold`) instead of CakeToHome Navy (`#1D2F5D`) / Gold (`#D4AF37`).
3. **Popup Manager Color & Contrast Regressions:** The popup editor and simulator defaulted to `#e11d48` (crimson/rose) rather than CakeToHome Navy/Gold, with simulator warning boxes having low contrast in dark cards. The image tab defaulted to `/images/belgian-truffle.jpg` (pizza) rather than selecting authentic cakes from the Media Library.
4. **Branch Manager API Crash (500 Error):** `/api/v1/manager/dashboard` and `/api/v1/manager/orders` crashed with `TypeError: (o.created_at || "").slice is not a function` in `frontend/src/lib/api-engine.ts` because PostgreSQL `pg` driver returns `created_at` as a native `Date` object, not a string.
5. **Location Modal GPS & Contrast:** The location modal's GPS button suffered from Medusa UI secondary button style override, and `newLoc` concatenation appended stray dashes when no pincode was present.
6. **Zero Price Bug on Pastries:** Pastries on `/products` displayed `₹0` because fallback pricing checked `product.price` instead of `product.selling_price || product.price`.

---

## User Review Required

> [!IMPORTANT]
> **Zero Destructive Actions:** All changes are strictly additive or in-place fixes. No existing migrations, tables, database records, or historical orders will be truncated, dropped, or deleted. Commits and git pushes remain disabled until final user sign-off.
>
> **Media Asset Replacement:** The 7 duplicate pizza files in `frontend/public/images/` will be replaced with genuine high-resolution cake imagery aligned with CakeToHome's gourmet bakery brand.

---

## Open Questions

None. All root causes have been empirically reproduced, diagnosed, and isolated.

---

## Proposed Changes

### 1. Storefront Styling & Design System Repair

#### [MODIFY] [frontend/public/images/](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/public/images/)
- Replace the 7 identical 208KB pizza image files (`belgian-truffle.jpg`, `chocolate-cake.jpg`, `red-velvet-heart.jpg`, `strawberry-cake.jpg`, `default-cake.jpg`, `placeholder-cake.jpg`, `default-og-cake.jpg`) with authentic gourmet cake imagery.
- Ensure all product cards and PDP fallbacks render genuine cakes.

#### [MODIFY] [frontend/src/components/store/shop/product-detail-client.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/shop/product-detail-client.tsx)
- Change root wrapper from `bg-navy-surface` to `bg-brand-cream` / `text-brand-text` for full visual harmony with header and footer.
- Replace `bg-rosegold` buttons and badges with CakeToHome primary action `#1D2F5D` (Navy) and `#D4AF37` (Gold).
- Remove hardcoded dark container styles (`bg-obsidian-base`, `text-pearl`) so all text, options, and size buttons have high-contrast readable styling on light backgrounds.
- Fix delivery timing check box contrast.

#### [MODIFY] [frontend/src/components/store/shop/product-reviews-section.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/shop/product-reviews-section.tsx)
- Ensure "Verified Customer Reviews" heading and review cards use theme-aware high-contrast text (`text-[#1D2F5D]` on light cards, `text-white` on dark mode).
- Ensure rating distribution bars and filter buttons use brand navy/gold tokens.

#### [MODIFY] [frontend/src/components/store/catalog/product-card.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/catalog/product-card.tsx)
- Fix price fallback: `selling_price ?? price ?? 499` to eliminate `₹0` prices on pastries.
- Ensure image error fallback points to genuine cake placeholder, not pizza.

#### [MODIFY] [frontend/src/components/store/catalog/products-catalog-client.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/catalog/products-catalog-client.tsx)
- Fix "Showing [blank] of [blank] artisan cakes" count display bug.
- Fix top banner text contrast ("Handcrafted Gourmet Cakes" on dark background: ensure light high-contrast text).

---

### 2. Location Modal & Pincode-Free Flow

#### [MODIFY] [frontend/src/components/store/location/delivery-location-header.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/location/delivery-location-header.tsx)
- Redesign "Use Current GPS Location" button with explicit `#1D2F5D` navy styling, prominent gold GPS icon, and crystal-clear loading/error states.
- Fix `newLoc` formatting in `handleResolveLocation`: avoid trailing ` — ` when resolving GPS or area without pincode.
- Enhance State & City tab with instant one-click selector chips for popular bakery hubs (Bengaluru, Kochi, Chennai, Mumbai).

#### [MODIFY] [frontend/src/components/store/checkout/checkout-form.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/checkout/checkout-form.tsx)
- Remove orphaned `zipInputRef` focus call on Step 2.
- Ensure Step 2 validation cleanly passes when customer selects delivery address and slot without requiring a pincode.
- Align checkout styling with brand cream/navy theme.

---

### 3. Admin Popup Manager & Media Library Integration

#### [MODIFY] [frontend/src/components/dashboard/admin/popup-editor-drawer.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/popup-editor-drawer.tsx)
- Change default accent color from `#e11d48` (rose) to `#1D2F5D` (Navy) with `#D4AF37` (Gold) options.
- Change default popup image from `/images/belgian-truffle.jpg` to a gourmet celebration cake from Media Library.
- Enhance simulator diagnostic status box:
  - Clear high-contrast badge and explanatory checklist.
  - Explicit explanation when popup is in Preview Mode vs Live Match.
  - Clear notice that "⚡ Trigger Now" bypasses frequency and audience rules for design testing.
- Ensure inputs, tabs, and drawer footer have WCAG 2.1 AA text contrast across all 9 tabs.

#### [MODIFY] [frontend/src/components/store/engagement/storefront-popup-modal.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/engagement/storefront-popup-modal.tsx)
- Change default `accentColor` fallback from `#e11d48` to `#1D2F5D`.
- Ensure coupon badges, CTAs, and close buttons use CakeToHome brand tokens.

---

### 4. Branch Manager Backend Repair

#### [MODIFY] [frontend/src/lib/api-engine.ts](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts)
- Fix lines 21185, 21324, 20513, 20581, 20582:
  Convert `o.created_at` safely with `(o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at || "")).slice(0, 10)`.
- Verify `/api/v1/manager/dashboard` and `/api/v1/manager/orders` return HTTP 200.

---

### 5. Full-Stack End-to-End Verification

#### [NEW] [scratch/verify_complete_journey.js](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/verify_complete_journey.js)
- Automated Playwright script that:
  1. Opens Homepage and sets location via GPS / Area.
  2. Navigates to `/products`, verifies cake imagery and prices.
  3. Opens `/products/chocolate-truffle`, selects 1kg variant, verifies high-contrast styling and reviews.
  4. Adds cake to cart, navigates to `/cart`, clicks Checkout.
  5. Enters contact info and delivery address without typing any pincode.
  6. Selects delivery slot and places order.
  7. Verifies order confirmation page.
  8. Queries PostgreSQL directly to verify order row, items, and branch assignment.
  9. Verifies order in Admin Orders view (`?tab=orders`).
  10. Verifies order in Branch Manager dashboard (`/dashboard/fulfillment` or `/api/v1/manager/orders`).

---

## Verification Plan

### Automated Tests
1. **TypeScript Compilation:**
   ```powershell
   node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit
   ```
2. **Branch Manager API Test:**
   Verify `/api/v1/manager/dashboard` and `/api/v1/manager/orders` return HTTP 200 with active KPIs and orders.
3. **Admin Tabs Audit:**
   ```powershell
   node scratch/test_admin_tab_audit.js
   ```
   Confirm all 22 admin tabs return HTTP 200 with zero exceptions.
4. **End-to-End Ordering & DB Test:**
   ```powershell
   node scratch/verify_complete_journey.js
   ```
   Confirm complete customer journey from homepage to PostgreSQL order persistence.
5. **Multi-Viewport Visual Audit:**
   Audit across 1440x900, 1024x768, 768x1024, 430x932, 390x844, 375x812, 320x700 with zero overflow and verified contrast.

### Documentation & Checkpoints
- Generate `CHECKPOINT_<timestamp>_FULL_REPAIR_COMPLETE.md`
- Update `task.md`, `recovery-log.md`, `walkthrough.md`
