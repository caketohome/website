# CakeToHome Checkpoint: PDP Inspection & Architecture Baseline

```text
Checkpoint ID: CHECKPOINT_20260917_145000_PDP_INSPECTION_AND_PLAN
Date and time: 2026-09-17 14:50:00 UTC+05:30
Git branch: task/dev
Current commit: 308162125fd72ef30c31176ac3312b9e15ff55a2
Task being performed: CakeToHome Product Page Redesign — Inspection & Implementation Planning
Stage: Inspection Complete & Architecture Plan Formulated
```

## 1. Summary of Inspection Findings

### A. Existing Product Page Architecture
- **Route:** `frontend/src/app/(store)/products/[id]/page.tsx`
  - Server-side component querying PostgreSQL via `getProductById(targetId)` and fallback `getProductBySlug(targetId)` in `frontend/src/lib/data/catalog.ts`.
  - Authoritative repository: `ProductRepository.findById` / `findBySlug` querying `"product"` table in PostgreSQL.
  - Review retrieval: `listProductReviews(productId)` with aggregate ratings & distribution.
  - JSON-LD: `ProductJsonLd` generated server-side.
  - SEO Metadata: `SeoMetadataBuilder.buildMetadata` dynamically generated.
- **Client Component:** `frontend/src/components/store/shop/product-detail-client.tsx`
  - Monolithic component (1,062 lines) combining gallery, options, customization, purchase, delivery badge, tabs, reviews, and confirmation modal.
  - Needs modular decomposition into dedicated components in `frontend/src/components/store/pdp/`.

### B. CMS / PIM Architecture & Gaps Identified
- **CMS Repository:** `frontend/src/lib/repositories/cms.repository.ts`
  - Operates on PostgreSQL table `cms_page`.
  - Current state: 21 rows in `cms_page` (`cmspg_home`, `cmspg_products`, `terms`, `privacy`, etc.).
  - **Gap 1:** There is currently NO row with `slug: 'product'` in `cms_page`. `getCmsPage("product")` returns `null`, falling back to `{}` for `pdpConfig`.
  - **Gap 2:** `CmsRepository.savePage` does not persist `pdp_config` in `blocks` JSON column.
  - **Gap 3:** `CmsRepository.publishPage` does not copy `pdp_config` to `published_config.pdp`.
  - **Gap 4:** In `page-configurator.tsx` (line 1496), `onChange={(newCfg) => updateField("pdp_config", newCfg)}` expects `(key, val)` from `PdpBuilderEditor`, overwriting `pdp_config` improperly.

### C. Design System & Tokens
- Cream background: `#FDFBF7` / `bg-store-cream`
- Primary Navy: `#1D2F5D` / `text-store-navy`
- Accent Gold: `#D4AF37` / `text-store-gold`
- Accent Rose Gold: `#B76E79`
- Card radii: `rounded-2xl` (16px), `rounded-3xl` (24px), `rounded-[32px]`
- Safe margins and sticky bar support for mobile viewports.

---

## 2. Planned Changes
1. **CMS Persistence & Architecture:**
   - Seed default `cms_page` row for `slug: 'product'`, `page_type: 'product'` in PostgreSQL.
   - Update `CmsRepository` to persist and publish `pdp_config`.
   - Fix `page-configurator.tsx` `PdpBuilderEditor` binding to support live edits and persistence.
2. **Modular Storefront PDP Components (`frontend/src/components/store/pdp/`):**
   - `pdp-breadcrumb.tsx`
   - `pdp-gallery.tsx`
   - `pdp-info-panel.tsx`
   - `pdp-variant-selector.tsx`
   - `pdp-customization-form.tsx`
   - `pdp-purchase-actions.tsx`
   - `pdp-sticky-bar.tsx`
   - `pdp-delivery-checker.tsx`
   - `pdp-highlights.tsx`
   - `pdp-info-tabs.tsx`
   - `pdp-related-products.tsx`
   - `pdp-faq-section.tsx`
   - `pdp-empty-message-modal.tsx`
3. **Refactored `ProductDetailClient`:**
   - Clean orchestrator component adhering to CMS section ordering and toggles.
4. **Server Page (`products/[id]/page.tsx`):**
   - Fetch related products from DB to avoid client waterfall.
   - Robust `pdpConfig` resolution from PostgreSQL `cms_page`.

---

## 3. Next Safe Action
Obtain user approval for the implementation plan in `implementation_plan.md`.
