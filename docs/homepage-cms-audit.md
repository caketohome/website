# Forensic Audit: CakeToHome Homepage & CMS Architecture

> **Document Version**: 1.0.0  
> **Status**: Complete — Forensic Audit Phase 0  
> **Target System**: CakeToHome Modern Bakery Commerce & Operations Platform  
> **Scope**: Storefront Homepage, CMS Page Builder, Database Source-of-Truth, Animation Systems, Catalog Data Pipelines, Next.js Boundaries

---

## Executive Summary

This forensic audit investigates the CakeToHome homepage rendering pipeline, the CMS Page Builder (`PageConfigurator`), the PostgreSQL data layers, the section component registry, scroll animations, and runtime authority. 

The primary architectural defect identified is a **storefront CMS bypass introduced in commit `9bda4a8`**:
`frontend/src/app/(store)/page.tsx` was modified to render a standalone `<LuxuryStorefront>` component instead of the canonical `<PageRenderer>`. While `<LuxuryStorefront>` demonstrated the target luxury patisserie aesthetic (`#0c1326`, `#142040`, `#D4AF37`, Playfair serif typography), it completely ignored the CMS `sections` array and hardcoded static copy and structures. Consequently, administrator edits and published CMS pages in PostgreSQL were disconnected from the storefront homepage.

The canonical architecture already possesses a complete 125-section engine (`PageRenderer`), scroll frame sequence canvas scrubber (`ScrollFrameHero`), hardware-accelerated entrance motion (`SectionMotionWrapper`), and direct PostgreSQL data layers (`CmsRepository`, `ProductRepository`, `BranchRepository`, `InventoryService`). 

The correct engineering solution is **not** to maintain a hardcoded storefront, but to **empower the canonical `PageRenderer` with the luxury design tokens, typography, and section styling**, restoring PostgreSQL as the runtime source of truth while achieving the patisserie aesthetic.

---

## 1. Current Homepage Architecture

The storefront homepage is defined at [frontend/src/app/(store)/page.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/(store)/page.tsx).

### Execution Trace (Server Component)
```
Browser HTTP Request (/)
  ↓
frontend/src/app/(store)/page.tsx (Next.js Server Component, force-dynamic, revalidate=0)
  ├── cookies() -> extracts _cth_branch_id, _cth_pincode
  ├── getHomepage() -> CmsRepository.findPageBySlug("home") -> PostgreSQL ("cms_page")
  ├── listProducts({ branchId, pincode }) -> ProductRepository.findAll(100) -> PostgreSQL ("product", "branch_inventory")
  ├── listPimCategories() -> PostgreSQL ("product_category", "product")
  ├── listOccasions() -> PostgreSQL ("cms_page", "product")
  └── listPublicOffers() -> OfferRepository.findAll() -> PostgreSQL ("offers")
```

### The Render Defect (Bypass)
Prior to commit `9bda4a8`, `page.tsx` rendered `<PageRenderer sections={sections} ... />`.
In commit `9bda4a8`, this was replaced with:
```tsx
<LuxuryStorefront 
  sections={sections}
  banners={banners}
  allProducts={allProducts}
  allCategories={allCategories}
  occasions={occasions}
  announcementBar={announcementBar}
/>
```
Inside [frontend/src/components/store/home/luxury-storefront.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/home/luxury-storefront.tsx), the `sections`, `banners`, `occasions`, and `announcementBar` props are never destructured or rendered. The component renders a static, hardcoded page layout.

---

## 2. Current CMS Architecture

The CMS Page Builder is implemented across three core files:
1. **Admin Page Configurator UI**: [frontend/src/components/dashboard/admin/page-configurator.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/page-configurator.tsx) (1,460 lines)
2. **Central Section Registry**: [frontend/src/lib/cms/section-registry.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/cms/section-registry.ts) (125 section types registered across 12 categories)
3. **Section Configuration Editor**: [frontend/src/components/dashboard/admin/section-config-editor.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/section-config-editor.tsx)
4. **Canonical Storefront & Canvas Renderer**: [frontend/src/components/store/cms/page-renderer.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/cms/page-renderer.tsx) (3,442 lines)

### Data Flow for CMS Editing & Publishing
```
[Admin Browser] PageConfigurator UI
  ↓ (drag, reorder, edit fields, add sections)
Local React State (editingPage, undoStack, redoStack)
  ↓ "Save Draft" (PUT /api/v1/cms/pages/:id)
Next.js Route Handler [frontend/src/app/api/v1/[...path]/route.ts]
  ↓ CmsRepository.savePage({ ...body, id })
PostgreSQL Database ("cms_page" table, status="draft", blocks JSONB updated)
  ↓ "Publish" (POST /api/v1/cms/pages/:id/publish)
ApiEngine.publishCmsPage(id)
  ├── Validate title, slug, meta_title, meta_description, sections
  ├── Freeze draft sections & config into published_config
  ├── Set status = "published", published_at = NOW()
  ├── Persist to PostgreSQL "cms_page"
  └── revalidatePath("/") & revalidatePath("/(store)")
```

---

## 3. Current Database Source-of-Truth Matrix

| Data Entity | PostgreSQL Table | Repository / Service | Access Pattern | Authority Status |
|---|---|---|---|---|
| CMS Page (`home`) | `cms_page` | `CmsRepository.findPageBySlug` | Raw SQL (`dbQuery`) | ✅ PostgreSQL DB Authoritative |
| Products | `product` | `ProductRepository.findAll` | Raw SQL (`dbQuery`) | ✅ PostgreSQL DB Authoritative |
| Product Prices | `product.metadata` | `ProductRepository` / `listProducts` | Raw SQL (`selling_price`) | ✅ PostgreSQL DB Authoritative |
| Categories | `product_category` | `listPimCategories` | Raw SQL with `pc` join `p` | ✅ PostgreSQL DB Authoritative |
| Occasions | `cms_page` / `product` | `listOccasions` | Raw SQL distinct `metadata->>'occasion'` | ✅ PostgreSQL DB Authoritative |
| Offers | `offers` | `OfferRepository.findAll` | Raw SQL (`dbQuery`) | ✅ PostgreSQL DB Authoritative |
| Branch Inventory | `branch_inventory` | `InventoryService.getBatchStock` | Raw SQL `SELECT stock WHERE branch_id AND product_id = ANY(...)` | ✅ PostgreSQL DB Authoritative |
| Branch Locations | `branch` | `BranchRepository.findByPincode` | Raw SQL (`dbQuery`) | ✅ PostgreSQL DB Authoritative |
| Version History | `cms_page.blocks->version_history` | `CmsRepository.savePage` | JSONB column (pruned to last 5) | ✅ PostgreSQL DB Authoritative |

---

## 4. Current Homepage Sections (in PostgreSQL `cmspg_home`)

A live database query executed on `cms_page` (`id = 'cmspg_home'`) revealed 10 active sections in `published_config.sections`:
1. `hero` (id: `sec_hero_root`) — Configured with multi-device scroll sequence frames (`scrollSequenceFrames.desktop` containing 22 WebP frames: `frame_001.webp` through `frame_022.webp`).
2. `category_grid` (id: `sec_categories_root`) — Sourced from category taxonomy.
3. `product_grid` (id: `sec_bestsellers_root`) — Dynamic product mode `best_sellers`.
4. `occasions_grid` (id: `sec_occasions_root`) — Occasions exploration.
5. `features` (id: `sec_features_root`) — Value propositions (same-day delivery, 100% eggless, artisanal).
6. `cta` (id: `sec_custom_cake_root`) — Custom cake ordering CTA.
7. `split_hero` (id: `sec_editorial_story_root`) — Master Baker story.
8. `product_grid` (id: `sec_featured_root`) — Dynamic product mode `featured`.
9. `testimonials` (id: `sec_reviews_root`) — Customer reviews & social proof.
10. `faq` (id: `sec_faq_root`) — Frequently asked delivery and ordering questions.

---

## 5. Current CMS-Supported Sections

The CakeToHome CMS Page Builder has 125 registered section types in [frontend/src/lib/cms/section-registry.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/cms/section-registry.ts), organized into 12 categories:
- **Header & Navigation (5)**: `announcement_bar`, `header`, `mega_menu`, `breadcrumbs`, `store_locator`.
- **Hero & Visual Impact (10)**: `hero`, `hero_video`, `split_hero`, `full_width_image`, `image_text`, `video_text`, `promotional_banner`, `campaign_banner`, `kitchen_story`, `before_after`.
- **Products & Catalog (12)**: `product_grid`, `product_carousel`, `featured_products`, `best_sellers`, `new_arrivals`, `trending_products`, `recommendations`, `recently_viewed`, `related_products`, `product_spotlight`, `product_comparison`, `quick_shop`.
- **Categories & Navigation (8)**: `category_grid`, `category_carousel`, `category_tiles`, `featured_categories`, `cake_type_explorer`, `flavor_explorer`, `weight_explorer`, `price_range_explorer`.
- **Occasions & Celebrations (9)**: `occasions_grid`, `occasion_carousel`, `birthday_cakes`, `anniversary_cakes`, `wedding_cakes`, `kids_cakes`, `corporate_cakes`, `festival_cakes`, `celebration_cakes`.
- **Conversion & Urgency (13)**: `deal_banner`, `limited_time_offer`, `flash_sale`, `discount_strip`, `coupon_code`, `free_delivery_banner`, `midnight_delivery_cta`, `same_day_delivery_cta`, `custom_cake_cta`, `corporate_orders_cta`, `whatsapp_cta`, `product_spotlight_cta`, `chef_recommendations`.
- **Trust & Social Proof (11)**: `testimonials`, `reviews`, `rating_summary`, `trust_badges`, `certifications`, `why_choose_us`, `quality_promise`, `freshness_promise`, `delivery_promise`, `customer_count`, `review_carousel`.
- **Brand & Storytelling (12)**: `brand_story`, `our_bakery`, `our_kitchen`, `founder_story`, `craftsmanship`, `ingredients`, `behind_the_scenes`, `meet_the_bakers`, `bakery_timeline`, `milestone_counter`, `awards`, `press_coverage`.
- **Content & SEO (18)**: `text_content`, `rich_text`, `faq`, `accordion`, `quote`, `blog_grid`, `blog_carousel`, `featured_article`, `seo_content`, `location_content`, `occasion_content`, `cake_care_guide`, `flavor_guide`, `size_guide`, `delivery_guide`, `internal_links`, `related_categories_content`, `related_products_content`.
- **Delivery & Geography (10)**: `location_coverage`, `delivery_availability`, `delivery_time_selector`, `pincode_checker`, `city_selector`, `branch_finder`, `delivery_zones`, `serviceability_map`, `same_day_delivery_info`, `midnight_delivery_info`.
- **Lead Generation & Contact (8)**: `contact_form`, `newsletter`, `whatsapp_cta_lead`, `corporate_enquiry`, `custom_cake_enquiry`, `bulk_order_form`, `callback_request`, `event_cake_enquiry`.
- **Footer & Utility (9)**: `footer`, `footer_links`, `social_links`, `app_download`, `payment_methods`, `delivery_information`, `legal_links`, `contact_information`, `branch_locations`.

---

## 6. Current Sections That Cannot Be Represented in CMS

**Zero**. All 125 sections are registered and recognized by both the editor and renderer.
However, **visual representation deficiencies exist**:
- The current default templates and CSS styling inside `PageRenderer` render sections with standard light e-commerce card patterns (white containers, light gray borders, standard Sans typography).
- The luxury aesthetic seen in the screenshots (dark navy background `#0c1326` / `#142040`, gold accents `#D4AF37`, Playfair Display serif typography, asymmetric editorial hero layouts, gold badge pills, glassmorphism) was hardcoded in `LuxuryStorefront` rather than wired into `PageRenderer`'s styling themes and design tokens.

---

## 7. Current Animation Capabilities

The codebase contains two distinct, high-performance animation engines:
1. **Scroll-Frame Scrubbing Engine** (`ScrollFrameHero` in [frontend/src/components/store/animation/scroll-frame-hero.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/animation/scroll-frame-hero.tsx)):
   - HTML5 `<canvas>` rendering controlled by window scroll scrubbing via `requestAnimationFrame`.
   - Multi-device frame sets (separate desktop, tablet, and mobile WebP image sequence arrays).
   - Smoothing modes (`off`, `low`, `medium`, `high`), first/final frame hold percentages.
   - Story phases (3 scroll-triggered narrative phases: Hero, Craft/Kitchen, Fleet/Delivery).
   - Automatic fallback to static poster when `prefers-reduced-motion: reduce` is active.
2. **Section Entrance Animation Engine** (`SectionMotionWrapper` in [frontend/src/components/store/cms/page-renderer.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/cms/page-renderer.tsx)):
   - Lightweight `IntersectionObserver` triggering GPU-accelerated CSS transforms (`translate3d`, `opacity`, `cubic-bezier(0.16, 1, 0.3, 1)`).
   - Supported types: `fade_up`, `fade_down`, `slide_left`, `slide_right`, `scale`, `reveal`.
   - Full support for `prefers-reduced-motion: reduce`.
3. **Framer Motion Micro-Interactions**:
   - Staggered children container variants and subtle card hover elevations.

---

## 8. Current Media Capabilities

- Media references are stored as external URLs or cloud storage paths (e.g. Supabase Storage / `/uploads/`).
- No large base64 data payloads are saved into `cms_page` blocks (prevented by design and verified by inspection).
- In version history snapshots, large frame arrays (`frames.length > 5`) are automatically stripped before persisting to avoid JSON bloat in PostgreSQL `cms_page`.
- Hero scroll frames use modern WebP format (`frame_001.webp` to `frame_022.webp`).
- Responsive Next.js `<Image>` components are utilized with `priority` on above-the-fold hero imagery and lazy loading on below-the-fold cards.

---

## 9. Current Product / Category / Offer Bindings

- **Product Dynamic Binding**: Handled by `resolveProducts(config, allProducts)` in `PageRenderer`. Products are filtered dynamically by:
  - `manual`: Specific IDs chosen in CMS.
  - `best_sellers`: Filtered where `is_bestseller = true` or sorted by sales.
  - `featured`: Filtered where `is_featured = true`.
  - `new_arrivals`: Filtered where `is_new_arrival = true`.
  - `category`: Filtered by `category_id` or `category_slug`.
- **Product Price Authority**: Prices are never duplicated in CMS blocks. The product repository supplies `selling_price`, `mrp`, and `price` from PostgreSQL.
- **Category Dynamic Binding**: `listPimCategories()` pulls from `product_category` table with real product counts.
- **Occasion Binding**: `listOccasions()` queries distinct occasions from PostgreSQL product metadata.
- **Offer Binding**: Sourced from `OfferRepository.findAll()`.

---

## 10. Current Branch / Pincode Behavior

- Customer branch and pincode context is maintained in cookies: `_cth_branch_id` and `_cth_pincode`.
- In `page.tsx`, `listProducts({ branchId, pincode })` passes this context to `ProductRepository` and `InventoryService`.
- Stock availability is fetched in a single batch query via `InventoryService.getBatchStock(targetBranchId, productIds)` against `branch_inventory`.
- Out of stock products display branch-specific stock status.
- Branch isolation established in Phase 8.1 is strictly preserved.

---

## 11. Current SEO Behavior

- Handled in `generateMetadata()` in `frontend/src/app/(store)/page.tsx`.
- Queries `getHomepage()` directly.
- Uses `page.meta_title`, `page.meta_description`, `page.canonical_url`, and `page.og_image` stored in `cms_page` in PostgreSQL.
- OpenGraph tags, Twitter cards, and structured JSON-LD schemas are generated via `SeoMetadataBuilder`.

---

## 12. Current Caching Behavior

- `frontend/src/app/(store)/page.tsx` explicitly specifies:
  ```ts
  export const dynamic = "force-dynamic";
  export const revalidate = 0;
  ```
- This ensures zero stale caching of pricing, branch availability, or CMS configuration.
- Next.js tag/path revalidation (`revalidatePath("/")`) is triggered upon CMS publish.
- Strict compliance with Phase 8.1 cache safety rules (dynamic pricing and inventory are never cached in CDN or static build files).

---

## 13. Current Performance Characteristics

- **Phase 8.1 Compliance**: Branch and pincode isolation verified.
- **Phase 8.2 Compliance**: N+1 queries eliminated via batch inventory lookups (`InventoryService.getBatchStock`).
- **Phase 8.3 Compliance**: Active database indexes on `cms_page (id, slug, status)`, `product (id, deleted_at)`, and `branch_inventory (branch_id, product_id)`.
- **Phase 8.4 Compliance**: Bounded reads (`findAll(100)`), preventing unbounded memory allocation.
- **Bundle Optimization**: `ScrollFrameHero` is loaded dynamically via `next/dynamic` (`ssr: false`), preventing heavy canvas code from polluting the initial SSR HTML payload.

---

## 14. Current Problems & Deficiencies

1. **Storefront Renderer Bypass (Critical)**: `page.tsx` renders `<LuxuryStorefront>` which ignores CMS `sections`, disconnecting PostgreSQL CMS edits from the customer storefront.
2. **Visual Gap in `PageRenderer`**: `PageRenderer` currently uses basic e-commerce styling. It lacks the dark navy (`#0c1326`), gold (`#D4AF37`), Playfair serif typography, and luxury patisserie card designs demonstrated in `LuxuryStorefront`.
3. **Theme Application Gaps**: While `theme` is defined in CMS schema (`bg_color`, `text_color`, `font_family`, `heading_font`), individual section components inside `PageRenderer` do not dynamically inherit the luxury theme tokens.
4. **Hero Dual-Mode Coordination**: The hero section needs clean, seamless coordination between:
   - Mode A: Interactive canvas scroll frame sequence (`ScrollFrameHero`) when frames are configured.
   - Mode B: Premium static/editorial hero with Playfair serif typography and gold accents when scroll sequence is disabled.

---

## 15. Recommended Smallest-Safe Architecture

1. **Restore Canonical Routing in `page.tsx`**:
   Route `(store)/page.tsx` through `<PageRenderer>` with authoritative server-fetched data (`sections`, `banners`, `allProducts`, `allCategories`, `occasions`, `announcementBar`).
2. **Elevate `PageRenderer` to the Luxury Patisserie Design System**:
   - Apply the luxury background palette (`radial-gradient(ellipse at top right, #1d2d5a 0%, #142040 50%, #0c1326 100%)`) and text token `#FAF9F6`.
   - Apply Playfair Display typography to headings and Inter/Outfit to body.
   - Enhance the hero, category grid, product grid, signature collections, brand story, occasions, and trust badge section renderers with the luxury aesthetic.
3. **Preserve `ScrollFrameHero` Canvas Animation**:
   Ensure `ScrollFrameHero` remains the default for `hero` sections with active frame sequences, rendering within the luxury container with dark/gold badge overlays.
4. **Maintain 100% DB Source of Truth**:
   Continue sourcing all data through `CmsRepository`, `ProductRepository`, `BranchRepository`, and `InventoryService` with zero hardcoded prices, copy, or memoryStore authority.

---

## 16. Migration Phases

- **Phase 0**: Forensic Audit & Authority Matrix (Completed)
- **Phase 1**: CMS Schema & Capability Audit (Verify and confirm minimal extensions)
- **Phase 2**: Canonical CMS-Driven Homepage Renderer (Reconnect `page.tsx` to `PageRenderer`)
- **Phase 3**: Premium Hero (Dual-mode: Luxury Editorial Static + Canvas Scroll Sequence)
- **Phase 4**: Premium Collection & Category Sections
- **Phase 5**: Database-Backed Product Merchandising Sections (Preserving DB pricing & branch stock)
- **Phase 6**: Animation & Scroll Configuration
- **Phase 7**: Human-Centered UX & Conversion Improvements
- **Phase 8**: CMS Page Builder Enhancements
- **Phase 9**: Preview, Draft, Publish, Version History & Rollback Verification
- **Phase 10**: Performance, Accessibility, SEO & Security Verification
- **Phase 11**: Complete End-to-End Source-of-Truth Verification

---

## 17. Risk List & Mitigations

| Risk ID | Risk Description | Severity | Mitigation Strategy |
|---|---|---|---|
| R-01 | Reconnecting `PageRenderer` drops the luxury visual quality | High | Implement the luxury patisserie design tokens directly in `PageRenderer` and its child section renderers. |
| R-02 | Scroll animation regresses on mobile devices | Medium | Retain existing device-targeted frame sets (`desktop`, `tablet`, `mobile`) in `ScrollFrameHero` and test on all viewports. |
| R-03 | Product pricing becomes stale or cached in CMS blocks | Critical | Never store price in section config; always resolve prices from `allProducts` (PostgreSQL `ProductRepository`). |
| R-04 | Branch inventory N+1 query regression | High | Preserve batch fetching via `InventoryService.getBatchStock`. |
| R-05 | Version history bloats PostgreSQL JSONB | Medium | Maintain the existing pruning logic (max 5 versions, frame arrays stripped). |
| R-06 | Database connection pool exhaustion during live mutations | High | Never close the shared pool; use existing `dbQuery` helper with connection release. |
