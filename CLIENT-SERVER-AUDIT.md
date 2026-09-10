# CAKETOHOME SERVER/CLIENT BOUNDARY AUDIT (PHASE 4)
**Generated**: 2026-09-05T15:49:07.436Z  
**Total "use client" Files Audited**: 171  

---

## 1. Classification Summary

| Classification | File Count | Percentage | Action Plan |
| :--- | :--- | :--- | :--- |
| **KEEP CLIENT** | **149** | 87% | Legitimate interactive leaves (forms, active buttons, state hooks). Retain as client components. |
| **PUSH CLIENT BOUNDARY DOWN** | **4** | 2% | Route pages or large wrappers. Extract interactive parts to leaf components; convert wrapper to Server Component. |
| **MOVE TO SERVER** | **13** | 8% | Static presentation components without state/hooks. Remove `"use client"` directive. |
| **DYNAMIC IMPORT** | **5** | 3% | Heavy dependencies (Leaflet, ExcelJS, Lottie). Lazy-load with `next/dynamic` (`ssr: false`). |

---

## 2. High-Impact Refactoring Targets

### A. Dynamic Imports (Heavy Libraries)
These components bundle heavy JavaScript into the initial client graph. Converting them to `next/dynamic` saves hundreds of kilobytes:
- **`src/components/dashboard/admin/map-fence-editor.tsx`**: Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false.
- **`src/components/store/checkout/checkout-map.tsx`**: Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false.
- **`src/components/store/coverage-map.tsx`**: Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false.
- **`src/components/store/order/lottie-player.tsx`**: Heavy library detected (Lottie). Should be lazy-loaded via next/dynamic with ssr: false.
- **`src/components/store/order/order-status.tsx`**: Heavy library detected (Lottie). Should be lazy-loaded via next/dynamic with ssr: false.

### B. Push Client Boundary Down (Route Pages & Layouts)
Converting these route wrappers to Server Components reduces initial hydration overhead:
- **`src/app/(store)/compare/page.tsx`**: Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC.
- **`src/app/(store)/search/page.tsx`**: Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC.
- **`src/app/dashboard/page.tsx`**: Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC.
- **`src/app/offline/page.tsx`**: Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC.

### C. Move to Server (Pure Presentational Components)
These components contain no hooks, events, or browser APIs and should be pure Server Components:
- **`src/components/common/profile-badge.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/admin/admin-skeletons.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/admin/analytics-panel.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/admin/dashboard-skeleton.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/delivery-partner/create-category-drawer.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/login-form.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/menu/create-category-drawer.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/menu/create-product-drawer.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/menu/create-product-form.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/dashboard/menu/menu-actions.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/store/cart/cart-counter.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/store/checkout/order-summary.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.
- **`src/components/store/favorites/nav-favorites.tsx`**: Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.

---

## 3. Complete Audit of All 171 Client Files

| File Path | Classification | Hooks | Events | Browser APIs | Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/app/(store)/compare/page.tsx` | **PUSH CLIENT BOUNDARY DOWN** | ✓ | ✓ | ✓ | Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC. |
| `src/app/(store)/search/page.tsx` | **PUSH CLIENT BOUNDARY DOWN** | ✓ | ✓ | ✓ | Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC. |
| `src/app/dashboard/page.tsx` | **PUSH CLIENT BOUNDARY DOWN** | ✓ | ✓ | ✓ | Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC. |
| `src/app/error.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/app/global-error.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/app/offline/page.tsx` | **PUSH CLIENT BOUNDARY DOWN** | — | ✓ | ✓ | Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC. |
| `src/components/common/demo-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/common/error-component.tsx` | **KEEP CLIENT** | — | ✓ | — | Legitimate client component using event handlers . |
| `src/components/common/logout-button.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/common/profile-badge.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/admin/abandoned-cart/campaign-builder-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/abandoned-cart/recovery-journey-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/abandoned-cart-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/accessories-management-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/admin-skeletons.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/admin/admin-tabs.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/ai-concierge-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/analytics-panel.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/admin/announcement-bar-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branch-accessory-inventory-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branch-operations-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branch-pincode-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branch-product-availability-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branch-zone-manager.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/branch-zone-product-restrictions-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/branches-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/catalog-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/categories-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/category-image-uploader.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/category-select-dropdown.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/cities-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/cms-image-uploader.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/cms-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/audit-logs-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/branch-compliance-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/compliance/branch-compliance-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/business-profile-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/delivery-defaults-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/compliance/fssai-compliance-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/gst-registrations-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/integrations-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/invoice-billing-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/notifications-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/payment-config-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/compliance/security-tab.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/coupon-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/create-order-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/crm/customer-profile-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/crm/duplicate-merge-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/crm/whatsapp-contact-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/crm-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/cross-sell-rules-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/dashboard-skeleton.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/admin/delivery-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/delivery-partner-details-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/delivery-partner-wizard.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/delivery-simulator.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/enterprise-reports-engine.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/error-boundary.tsx` | **KEEP CLIENT** | — | ✓ | ✓ | Legitimate client component using event handlers browser APIs . |
| `src/components/dashboard/admin/features-section-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/fulfillment-config-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/login-activity-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/map-fence-editor.tsx` | **DYNAMIC IMPORT** | ✓ | ✓ | ✓ | Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false. |
| `src/components/dashboard/admin/marketing-automation-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/marketing-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/media-selector-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/multi-access-profile-select.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/notifications-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/occasion-selector.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/occasions-grid-editor.tsx` | **KEEP CLIENT** | — | ✓ | — | Legitimate client component using event handlers . |
| `src/components/dashboard/admin/occasions-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/order-details-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/order-invoice-print-modal.tsx` | **KEEP CLIENT** | — | ✓ | ✓ | Legitimate client component using event handlers browser APIs . |
| `src/components/dashboard/admin/order-kot-print-modal.tsx` | **KEEP CLIENT** | — | ✓ | ✓ | Legitimate client component using event handlers browser APIs . |
| `src/components/dashboard/admin/orders-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/page-builder.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/page-configurator.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/pdp-builder-editor.tsx` | **KEEP CLIENT** | — | ✓ | — | Legitimate client component using event handlers . |
| `src/components/dashboard/admin/pim-editor-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/popup-editor-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/popups-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/product-grid-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/promotional-banner-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/scroll-frame-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/search-config-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/section-config-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/seo-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/settings-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/split-hero-editor.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/staff-profiles-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/states-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/tax-master-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/telemarketing-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/variants-management-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/admin/webhooks-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/admin/weights-management-panel.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/delivery-partner/create-category-drawer.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/delivery-partner/delivery-buttons.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/login-form.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/menu/create-category-drawer.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/menu/create-product-drawer.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/menu/create-product-form.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/menu/menu-actions.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/dashboard/menu/menu-product-actions.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/realtime-client.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/dashboard/shop/assign-rider-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/shop/branch-operations-manager.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/shop/delivery-buttons.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/shop/invoice-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/shop/kot-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/dashboard/shop/order-details-drawer.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/dashboard/shop/shop-status.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/dashboard/signup-form.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/layout/profile-menu.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/account/account-dashboard-view.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/account/address-manager.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/account/order-detail-client.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/account/order-tracking-client.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/account/subscriptions-manager.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/account/wishlist-manager.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/ai-chat-assistant.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/animation/scroll-frame-hero.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/components/store/animation/scroll-sequence-canvas.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/components/store/animation/scroll-sequence-section.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/auth/otp-login-form.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/auth/smart-login-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/cart/cart-button.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/components/store/cart/cart-counter.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/store/cart/cart-fulfillment-validator.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/store/cart/cart-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/catalog/category-client-page.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/catalog/product-card.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/catalog/product-filters.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/catalog/products-catalog-client.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/checkout/checkout-form.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/checkout/checkout-map.tsx` | **DYNAMIC IMPORT** | ✓ | — | ✓ | Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false. |
| `src/components/store/checkout/order-summary.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/store/cms/announcement-bar-section.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/cms/page-renderer.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/cms/promotional-banner-section.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/coverage-map.tsx` | **DYNAMIC IMPORT** | ✓ | ✓ | ✓ | Heavy library detected (Leaflet ). Should be lazy-loaded via next/dynamic with ssr: false. |
| `src/components/store/cro-urgency-widgets.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/engagement/engagement-provider.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/components/store/engagement/storefront-popup-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/favorites/nav-favorites.tsx` | **MOVE TO SERVER** | — | — | — | Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component. |
| `src/components/store/home/storefront-product-homepage.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/location/delivery-location-header.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/marketing/countdown-timer.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/store/marketing/exit-intent-popup.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/marketing/gamification-widgets.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/marketing/newsletter-form.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/marketing/social-sharing.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/order/lottie-player.tsx` | **DYNAMIC IMPORT** | — | — | — | Heavy library detected (Lottie). Should be lazy-loaded via next/dynamic with ssr: false. |
| `src/components/store/order/order-status.tsx` | **DYNAMIC IMPORT** | ✓ | — | ✓ | Heavy library detected (Lottie). Should be lazy-loaded via next/dynamic with ssr: false. |
| `src/components/store/reviews-section.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/search/nav-search.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/seo/cwv-observer.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/components/store/shop/branch-location-modal.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/shop/dish-card.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/shop/product-detail-client.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/shop/product-fulfillment-badge.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/store/shop/product-reviews-section.tsx` | **KEEP CLIENT** | ✓ | ✓ | ✓ | Legitimate client component using React hooks event handlers browser APIs . |
| `src/components/store/shop/shop-categories.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/components/store/storefront-floating-widgets.tsx` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/components/store/whatsapp-support-button.tsx` | **KEEP CLIENT** | ✓ | ✓ | — | Legitimate client component using React hooks event handlers . |
| `src/hooks/use-addresses.ts` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/hooks/use-customer-profile.ts` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/hooks/use-orders.ts` | **KEEP CLIENT** | ✓ | — | — | Legitimate client component using React hooks . |
| `src/providers/auth-provider.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/providers/customer-provider.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
| `src/providers/favorites-provider.tsx` | **KEEP CLIENT** | ✓ | — | ✓ | Legitimate client component using React hooks browser APIs . |
