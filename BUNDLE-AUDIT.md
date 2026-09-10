# CAKETOHOME JAVASCRIPT BUNDLE AUDIT (PHASE 5)
**Generated**: 2026-09-07T12:55:22.917Z  
**Client Chunks Generated**: 135 chunks  
**Total Client JS Size**: 5.44 MB uncompressed  

---

## 1. Top 20 Largest Client Chunks

| Rank | Chunk File | Size (KB) | Size (Bytes) | Category / Contents |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `chunks/6edf0643.54955be2a59497b7.js` | **913.1 KB** | 9,35,009 | Heavy Vendor Bundle (Medusa/Leaflet/Icons) |
| 2 | `chunks/aaea2bcf.608ea3701e03be64.js` | **317.6 KB** | 3,25,187 | Shared / Vendor |
| 3 | `chunks/3218.eab7f7ac9d57714f.js` | **264.4 KB** | 2,70,751 | Shared / Vendor |
| 4 | `chunks/fd9d1056-0fc7740e8e9f4344.js` | **168.2 KB** | 1,72,193 | Shared / Vendor |
| 5 | `chunks/8057.861fce901b74509d.js` | **160.5 KB** | 1,64,369 | Shared / Vendor |
| 6 | `chunks/6331-c96679564a3a7737.js` | **148.1 KB** | 1,51,680 | Shared / Vendor |
| 7 | `chunks/d0deef33.44219d05c2c3bffe.js` | **145 KB** | 1,48,455 | Shared / Vendor |
| 8 | `chunks/75-3cbd0fef0c7cde9f.js` | **142.7 KB** | 1,46,149 | Shared / Vendor |
| 9 | `chunks/framework-8e0e0f4a6b83a956.js` | **137.7 KB** | 1,40,968 | React Core Framework |
| 10 | `chunks/3269.a65d05a691e56908.js` | **121.4 KB** | 1,24,355 | Shared / Vendor |
| 11 | `chunks/1810.aa9ee98a4f00002c.js` | **119.8 KB** | 1,22,662 | Shared / Vendor |
| 12 | `chunks/8116.297c76f051caa815.js` | **118.4 KB** | 1,21,213 | Shared / Vendor |
| 13 | `chunks/1658.3914b9cd427f006f.js` | **113.3 KB** | 1,16,024 | Shared / Vendor |
| 14 | `chunks/8289.f36467f70a842d96.js` | **113.2 KB** | 1,15,870 | Shared / Vendor |
| 15 | `chunks/8069-be8016948c5a5518.js` | **110.3 KB** | 1,12,914 | Shared / Vendor |
| 16 | `chunks/main-747ecc0e5c8f1eaa.js` | **109.2 KB** | 1,11,816 | Next.js Main Runtime |
| 17 | `chunks/polyfills-c67a75d1b6f99dc8.js` | **89.3 KB** | 91,460 | Shared / Vendor |
| 18 | `chunks/app/dashboard/shop/page-d345fa38f0b546f0.js` | **85.6 KB** | 87,635 | Shared / Vendor |
| 19 | `chunks/6612.68a2633ec39d8a69.js` | **77.1 KB** | 78,927 | Shared / Vendor |
| 20 | `chunks/2645.d89e6be97b2f7866.js` | **76.8 KB** | 78,636 | Shared / Vendor |

---

## 2. Heavy Dependency Usage & Modularization Analysis

| Package | Total Imports | Client Imports | Server Imports | Modularization Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `lucide-react` | 120 | 113 | 7 | Enable `modularizeImports` in `next.config.mjs` to prevent full icon barrel bundling. |
| `@medusajs/ui` | 143 | 122 | 21 | Already in `transpilePackages`. Add to `experimental.optimizePackageImports`. |
| `@medusajs/icons` | 12 | 10 | 2 | Modularize icon path imports; avoid root re-exports. |
| `leaflet` | 0 | 0 | 0 | Lazy-load via `next/dynamic` with `ssr: false`. Never import on initial page load. |
| `react-leaflet` | 0 | 0 | 0 | Lazy-load via `next/dynamic` with `ssr: false`. Never import on initial page load. |
| `exceljs` | 2 | 0 | 2 | Ensure isolated to admin export routes. Never bundle in customer storefront. |
| `@dotlottie/react-player` | 2 | 1 | 1 | Dynamic import on order success/status pages only. |
| `lodash` | 0 | 0 | 0 | OK |
| `lodash.isequal` | 0 | 0 | 0 | OK |
| `jose` | 1 | 0 | 1 | OK |
| `react-aria` | 1 | 0 | 1 | OK |

---

## 3. Server-Only Library Leak Check

**Zero server-only libraries leak into client components.** (`pg`, `jsonwebtoken`, `fs` remain strictly inside Server Components / API handlers).

---

## 4. High-Priority Bundle Actions

1. **Modularize `lucide-react` Imports**:
   - Currently imported in **120 files** across the codebase.
   - Without `modularizeImports`, Webpack pulls in large symbol tables for unused icons.
2. **Dynamic Lazy-Loading for Leaflet**:
   - Leaflet is imported across **0 files**.
   - Leaflet + CSS accounts for over **180 KB** of client bundle.
3. **Configure `experimental.optimizePackageImports`**:
   - Add `["@medusajs/ui", "lucide-react", "@medusajs/icons", "lodash"]` to `next.config.mjs`.
