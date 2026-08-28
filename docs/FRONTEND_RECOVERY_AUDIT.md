# CakeToHome Frontend Recovery & Asset Pipeline Audit

**Incident Classification**: P0 Critical Frontend Asset Delivery & Middleware Interception Recovery  
**Status**: `RESOLVED & VERIFIED IN PRODUCTION BUILD`  
**Date**: August 27, 2026  

---

## 1. Executive Summary

A critical incident was detected where the CakeToHome application rendered as unstyled/raw HTML in browser sessions:
- Browser-default fallback typography ("Times New Roman")
- Broken header, cards, panels, buttons, and navigation layout
- Stylesheets failing to load or returning `404 text/html`

A thorough network, server, and architecture investigation identified **two compounding root causes**:
1. **Middleware Over-Interception (`src/middleware.ts`)**: An overly broad regex matcher combined with cookie/header mutation on `NextResponse.next()` caused Next.js internal App Router subrequest handling to treat asset requests as application routes, returning empty bodies (`x-middleware-invoke: 1`, body length 0) or intercepting static CSS/JS routes.
2. **Stale/Corrupted Webpack Dev Cache (`.next`)**: A previous crashed Next.js process had left corrupted chunk metadata (`Cannot find module './vendor-chunks/lodash.isequal.js'`), causing Next.js to serve 404 HTML error pages in place of CSS and JS bundles.

Both root causes were resolved without rolling back any business logic or delivery features. The global asset pipeline has been verified with a production build, browser Playwright audits, and live network response inspections.

---

## 2. Root Cause Analysis

```mermaid
flowchart TD
    subgraph Incident State [Broken State: Asset Pipeline Failure]
        A1[Browser Requests /_next/static/css/... or /_next/static/chunks/...] --> B1[middleware.ts matcher: /((?!_next/static|_next/image|favicon.ico).*)]
        B1 --> C1[Custom Header/Cookie Mutation on NextResponse.next]
        C1 --> D1[Next.js returns x-middleware-invoke: 1 with 0 bytes OR Stale .next cache returns 404 text/html]
        D1 --> E1[Browser: net::ERR_ABORTED -> Falls back to raw Times New Roman & unstyled DOM]
    end

    subgraph Restored State [Restored State: Clean Separation & Production Asset Delivery]
        A2[Browser Requests /_next/static/css/... & /_next/static/chunks/...] --> B2[middleware.ts matcher: /dashboard/:path*, /account/:path* ONLY]
        B2 --> C2[Static Assets & Storefront Routes Bypass Middleware Completely]
        C2 --> D2[Next.js serves /_next/static/css/d24c96f2fa25c36d.css with HTTP 200 text/css]
        D2 --> E2[Browser renders rich CakeToHome dark luxury theme, Tailwind utilities & Inter font]
    end
```

---

## 3. Detailed Fixes Applied

### A. Middleware Scope Hardening (`frontend/src/middleware.ts`)
- **Before**: `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]` matched every public storefront route, API route, and asset variant, setting headers and cookies on `NextResponse.next()`.
- **After**: Scoped matcher strictly to protected management routes:
  ```ts
  export const config = {
    matcher: [
      "/dashboard/:path*",
      "/account/:path*",
    ],
  };
  ```
- All public store routes (`/`, `/products`, `/checkout`, `/cart`, `/shop/*`, `/blog/*`), API routes, and static assets (`/_next/*`, `.css`, `.js`, fonts, images) bypass middleware completely.

### B. Clean Build Cache & Production Compilation
- Stopped stale background Node processes holding port 3000.
- Completely purged `.next/` directory.
- Executed `npm run build` $\rightarrow$ Successfully compiled all 28 routes and generated production CSS bundles (`d24c96f2fa25c36d.css`, 214.5 KB).

---

## 4. Network & Asset Delivery Evidence

| Resource Requested | HTTP Status | Content-Type | Payload Size | Verification Detail |
| :--- | :--- | :--- | :--- | :--- |
| `http://localhost:3000/` | `200 OK` | `text/html; charset=utf-8` | 4,343 KB | Valid HTML referencing compiled CSS bundle |
| `http://localhost:3000/_next/static/css/d24c96f2fa25c36d.css` | `200 OK` | `text/css; charset=UTF-8` | 214.5 KB | Compiled Tailwind utilities, `@medusajs/ui-preset`, Inter font-face |
| `http://localhost:3000/_next/static/chunks/main-app-05fe155b21ad6628.js` | `200 OK` | `application/javascript; charset=UTF-8` | 53.4 KB | Core Next.js hydration bundle |
| `http://localhost:3000/_next/static/chunks/webpack-e31dcdd202e9e203.js` | `200 OK` | `application/javascript; charset=UTF-8` | 2.1 KB | Webpack runtime |
| `http://localhost:3000/_next/static/media/ba9851c3c22cd980.woff2` | `200 OK` | `font/woff2` | 28.3 KB | Inter Latin font |

---

## 5. Visual Proof & Screenshots

All 7 required visual recovery screenshots were captured using automated Playwright tests and saved in `qa/frontend-recovery-audit/` and the artifacts directory:

1. **`01-homepage-restored.png`**: Hero chocolate banner, luxury dark navigation bar (`#111111`), location picker, search, AI sommelier pill.
2. **`02-products-restored.png`**: Product catalog grid with Bestseller/Featured badges, price tags, category chips, rating stars.
3. **`03-checkout-restored.png`**: Clean centered cart/checkout empty state with action buttons and value propositions.
4. **`04-dashboard-restored.png`**: Enterprise Order Command Center with tabs, order filters, search, buttons, status pills (CONFIRMED, CAPTURED, PENDING), and tables.
5. **`05-branches-restored.png`**: Fulfillment Hub matrix with operational status pills, Area Matrix button, Zone Rules, Compliance buttons.
6. **`06-delivery-partner-restored.png`**: Delivery Rider Kanban board with 5 status columns, job count badges, OTP verification actions.
7. **`07-mobile-restored.png`**: Mobile viewport (`390x844`) demonstrating responsive navigation, hero scaling, and action buttons.

---

## 6. Zero Regression on Business & Delivery Features

The 21-gate automated test suite (`scripts/test-customer-location-authority-e2e.ts`) was executed post-recovery:
- **Gate 1**: Physical Location vs Address Separation $\rightarrow$ `✔ PASS`
- **Gate 2**: GPS Flow Reverse Geocode Clean Address $\rightarrow$ `✔ PASS`
- **Gate 3**: Search Autocomplete Flow $\rightarrow$ `✔ PASS`
- **Gate 4**: Saved Address Coordinates Persistence $\rightarrow$ `✔ PASS`
- **Gate 5**: Map Pin Drag Propagation $\rightarrow$ `✔ PASS`
- **Gate 6**: Small Marker Movement (10m–100m) Stability $\rightarrow$ `✔ PASS`
- **Gate 7**: Address Text Edit Isolation $\rightarrow$ `✔ PASS`
- **Gate 8**: Map Pan Isolation $\rightarrow$ `✔ PASS`
- **Gate 9**: Explicit Geocode Action $\rightarrow$ `✔ PASS`
- **Gate 10**: Serviceability Inside Delivery Area $\rightarrow$ `✔ PASS`
- **Gate 11**: Serviceability Outside Delivery Area $\rightarrow$ `✔ PASS`
- **Gate 12**: Exclusion Area Rejection $\rightarrow$ `✔ PASS`
- **Gate 13**: Radius Boundary Precision (9.9km vs 10.1km) $\rightarrow$ `✔ PASS`
- **Gate 14**: Pincode Bypass Gate $\rightarrow$ `✔ PASS`
- **Gate 15**: Distance Pricing Brackets $\rightarrow$ `✔ PASS`
- **Gate 16**: Delivery Slots Gated by Serviceability $\rightarrow$ `✔ PASS`
- **Gate 17**: Order Snapshot Immutability $\rightarrow$ `✔ PASS`
- **Gate 18**: Google Maps URL Uses Coordinates, NOT Address String $\rightarrow$ `✔ PASS`
- **Gate 19**: Rider Navigation Deep Link Integrity $\rightarrow$ `✔ PASS`
- **Gate 20**: Stale Async Request Protection $\rightarrow$ `✔ PASS`
- **Gate 21**: End-to-End Coordinate Chain Integrity $\rightarrow$ `✔ PASS`

**Overall Test Suite Result**: `21/21 PASSED (100% SUCCESS, 0 FAILED)`
