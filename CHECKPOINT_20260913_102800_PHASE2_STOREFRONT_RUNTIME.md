# CHECKPOINT — PHASE 2: STOREFRONT RUNTIME VERIFICATION (10 VIEWPORTS)

**Timestamp**: `2026-09-13 10:28:00 IST` (2026-09-13 04:58:00 UTC)  
**Repository Path**: `e:\vig\cakes2home-main\cakes2home-main`  
**Current Branch**: `task/dev`  
**Current Commit**: `308162125fd72ef30c31176ac3312b9e15ff55a2`  
**Previous Checkpoint**: `CHECKPOINT_20260913_101100_PHASE1_SOURCE_OF_TRUTH.md`  

---

## 1. Storefront Runtime Multi-Viewport Audit Results

Executed automated Playwright headless Chrome suite across all 10 target viewports on `http://localhost:3000`:

| Viewport | Device Class | HTTP Status | CSS Assets | JS Assets | Failed Assets | Hydration Errors | Horizontal Overflow | Search/Location Overlap | Screenshot |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **320x700** | Ultra-compact mobile | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (320px/320px)** | **NO** | `viewport_320x700_mobile-320.png` |
| **360x740** | Android compact | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (360px/360px)** | **NO** | `viewport_360x740_mobile-360.png` |
| **375x667** | iPhone SE / standard | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (375px/375px)** | **NO** | `viewport_375x667_mobile-375.png` |
| **390x844** | iPhone 14/15 | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (390px/390px)** | **NO** | `viewport_390x844_mobile-390.png` |
| **414x896** | iPhone XR/Plus | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (414px/414px)** | **NO** | `viewport_414x896_mobile-414.png` |
| **430x932** | iPhone 14/15 Pro Max | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (430px/430px)** | **NO** | `viewport_430x932_mobile-430.png` |
| **768x1024** | iPad / Tablet portrait | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (768px/768px)** | **NO** | `viewport_768x1024_tablet-768.png` |
| **1024x768** | iPad landscape / Netbook | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (1024px/1024px)** | **NO** | `viewport_1024x768_desktop-1024.png` |
| **1280x800** | Desktop Standard | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (1280px/1280px)** | **NO** | `viewport_1280x800_desktop-1280.png` |
| **1440x900** | Desktop Widescreen | **200 OK** | 1 (200) | 14 (200) | **0** | **0** | **NO (1440px/1440px)** | **NO** | `viewport_1440x900_desktop-1440.png` |

---

## 2. Forensic Resolution of Previous CSS/JS 404 Defect

- **Root Cause Confirmed**:
  1. `next/dynamic` with `ssr: false` in Server Component layout (`(store)/layout.tsx`) had previously thrown `TypeError: Cannot read properties of undefined (reading 'clientModules')`.
  2. Duplicate `public/favicon.ico` conflicted with App Router icon route.
  3. The unhandled 500 error triggered dev error HTML referencing stale unhashed chunks (`main-app.js`, `app/global-error.js`).
  4. Missing static asset `/images/placeholder-cake.jpg` resolved by linking `default-cake.jpg` to `placeholder-cake.jpg`.
- **Runtime Verification**:
  - `_next/static/css/app/layout.css` returns **HTTP 200** (241 KB).
  - All 14 JavaScript runtime chunks return **HTTP 200**.
  - Total failed CSS/JS assets = **0**.
  - Total hydration exceptions = **0**.
  - No broken unstyled layouts across any viewport.

---

## 3. Evidence Artifacts

- Evidence JSON: `scratch/phase2_storefront_runtime_evidence.json`
- 10 Viewport Screenshots saved in `scratch/screenshots/`:
  - `viewport_320x700_mobile-320.png`
  - `viewport_360x740_mobile-360.png`
  - `viewport_375x667_mobile-375.png`
  - `viewport_390x844_mobile-390.png`
  - `viewport_414x896_mobile-414.png`
  - `viewport_430x932_mobile-430.png`
  - `viewport_768x1024_tablet-768.png`
  - `viewport_1024x768_desktop-1024.png`
  - `viewport_1280x800_desktop-1280.png`
  - `viewport_1440x900_desktop-1440.png`

---

## 4. Next Phase: Phase 3 — Admin & CMS Page Builder Persistence Verification

- Execute the 17-step Admin CMS Page Builder verification.
- Modify Homepage subheading, save draft, verify remote PostgreSQL row.
- Publish, verify PostgreSQL published state, verify live storefront DOM.
- Verify persistence after server process restart.
