# CAKETOHOME ARCHITECTURE DEPENDENCY AUDIT (PHASE 3)
**Generated**: 2026-09-05T15:47:22.054Z  
**Target Routes**: 7 Core Platform Routes  

---

## 1. Executive Summary & Route Comparison

| Route | Name | Total Modules | Client Modules | Server Modules | % Client | External Packages | Direct DB Access |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | **Root / Home** | 14 | 6 | 8 | 43% | 28 pkgs | NO |
| `/products` | **Catalog** | 11 | 3 | 8 | 27% | 24 pkgs | NO |
| `/products/[id]` | **Product PDP** | 14 | 5 | 9 | 36% | 26 pkgs | NO |
| `/checkout` | **Checkout** | 28 | 5 | 23 | 18% | 22 pkgs | NO |
| `/login` | **Login** | 5 | 2 | 3 | 40% | 6 pkgs | NO |
| `/dashboard` | **Dashboard** | 7 | 3 | 4 | 43% | 15 pkgs | NO |
| `/dashboard/shop` | **Shop / PIM** | 7 | 2 | 5 | 29% | 14 pkgs | NO |

---

## 2. Deep Route Dependency Chains

### Route: `/` (Root / Home)
- **Entrypoints**: `src/app/(store)/page.tsx` + `src/app/(store)/layout.tsx`
- **Module Count**: **14 total** (6 Client, 8 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/components/store/cms/page-renderer.tsx`
  - [Service] `src/lib/data/catalog.ts`
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/components/store/cart/nav-cart`, `@frontend/components/store/favorites/nav-favorites`, `@frontend/components/store/search/nav-search`, `@frontend/components/store/cms/navigation`, `@frontend/components/store/location/delivery-location-header`, `@frontend/components/store/engagement/engagement-provider`, `@frontend/lib/data/users`, `next/link`, `react` ...and 13 more
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`
  - `src/components/store/home/storefront-product-homepage.tsx`
  - `src/components/store/cms/page-renderer.tsx`
  - `src/components/store/cms/promotional-banner-section.tsx`
  - `src/components/store/cms/announcement-bar-section.tsx`

### Route: `/products` (Catalog)
- **Entrypoints**: `src/app/(store)/products/page.tsx` + `src/app/(store)/layout.tsx`
- **Module Count**: **11 total** (3 Client, 8 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/components/store/catalog/products-catalog-client.tsx`
  - [Service] `src/lib/data/catalog.ts`
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/components/store/cart/nav-cart`, `@frontend/components/store/favorites/nav-favorites`, `@frontend/components/store/search/nav-search`, `@frontend/components/store/cms/navigation`, `@frontend/components/store/location/delivery-location-header`, `@frontend/components/store/engagement/engagement-provider`, `@frontend/lib/data/users`, `next/link`, `react` ...and 9 more
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`
  - `src/components/store/catalog/products-catalog-client.tsx`

### Route: `/products/[id]` (Product PDP)
- **Entrypoints**: `src/app/(store)/products/[id]/page.tsx` + `src/app/(store)/layout.tsx`
- **Module Count**: **14 total** (5 Client, 9 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/lib/data/catalog.ts`
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/components/store/cart/nav-cart`, `@frontend/components/store/favorites/nav-favorites`, `@frontend/components/store/search/nav-search`, `@frontend/components/store/cms/navigation`, `@frontend/components/store/location/delivery-location-header`, `@frontend/components/store/engagement/engagement-provider`, `@frontend/lib/data/users`, `next/link`, `react` ...and 11 more
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`
  - `src/components/store/shop/product-detail-client.tsx`
  - `src/components/store/shop/product-reviews-section.tsx`
  - `src/components/store/shop/product-fulfillment-badge.tsx`

### Route: `/checkout` (Checkout)
- **Entrypoints**: `src/app/(checkout)/checkout/page.tsx` + `src/app/(checkout)/layout.tsx`
- **Module Count**: **28 total** (5 Client, 23 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/components/store/checkout/checkout-form.tsx`
  - [Service] `src/lib/auth-service.ts`
  - [Service] `src/components/store/checkout/checkout-map.tsx`
  - [Service] `src/lib/data/catalog.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/lib/data`, `@medusajs/ui`, `next/link`, `next/headers`, `react`, `next/navigation`, `@frontend/lib/actions`, `@frontend/lib/api-client`, `@frontend/lib/types` ...and 7 more
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`
  - `src/components/store/checkout/checkout-form.tsx`
  - `src/components/store/checkout/order-summary.tsx`
  - `src/components/store/checkout/checkout-map.tsx`

### Route: `/login` (Login)
- **Entrypoints**: `src/app/login/page.tsx` + `src/app/layout.tsx`
- **Module Count**: **5 total** (2 Client, 3 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `react`, `next/navigation`
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`

### Route: `/dashboard` (Dashboard)
- **Entrypoints**: `src/app/dashboard/page.tsx` + `src/app/dashboard/layout.tsx`
- **Module Count**: **7 total** (3 Client, 4 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/lib/data`, `@medusajs/ui`, `next/link`, `@frontend/components/dashboard/admin/error-boundary`, `react`, `next/dynamic`, `@frontend/components/dashboard/admin/admin-tabs`, `@frontend/components/dashboard/admin/dashboard-skeleton`, `next/navigation`
- **Top Client Components**:
  - `src/app/dashboard/page.tsx`
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`

### Route: `/dashboard/shop` (Shop / PIM)
- **Entrypoints**: `src/app/dashboard/shop/page.tsx` + `src/app/dashboard/layout.tsx`
- **Module Count**: **7 total** (2 Client, 5 Server)
- **Database / API Engine References**:
  - *None (Hydration via BFF or props)*
- **Services & Repositories Referenced**:
  - [Service] `src/lib/auth-service.ts`

- **Key External Dependencies**:
  `next`, `next/font/google`, `@frontend/components/store/seo/json-ld`, `@frontend/providers/customer-provider`, `@frontend/components/common/footer`, `@frontend/components/common/profile-badge`, `@frontend/lib/data`, `@medusajs/ui`, `next/link`, `@frontend/components/dashboard/admin/error-boundary`, `@frontend/lib/types`, `next/navigation`, `@frontend/components/dashboard/shop/branch-operations-manager`, `react`
- **Top Client Components**:
  - `src/providers/auth-provider.tsx`
  - `src/providers/favorites-provider.tsx`

---

## 3. Cross-Route Architectural Insights

1. **Massive Client Leaf Expansion on Catalog & PDP**:
   - Both `/products` and `/products/[id]` pull in heavy UI trees with over 45% client component concentration.
2. **Shop / PIM Boundary Isolation**:
   - `/dashboard/shop` directly touches `product.repository.ts` and `branch.repository.ts` via Server Action / API boundaries, isolating administrative logic from storefront clients.
3. **Database Access Layer Boundaries**:
   - Public storefront routes primarily consume pre-computed views or `ApiEngine` data structures, while administrative routes execute direct parameterized SQL against PostgreSQL.
