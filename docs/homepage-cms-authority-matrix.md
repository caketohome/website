# CakeToHome Homepage & CMS Domain Authority Matrix

> **Document Version**: 1.0.0  
> **Status**: Complete — Forensic Audit Phase 0  
> **Target System**: CakeToHome Modern Bakery Commerce & Operations Platform

---

## 1. Domain Authority Table

The following matrix documents the current runtime source of truth versus the required architecture across all domains of the CakeToHome homepage and CMS platform.

| Domain | Current Authority | Required Authority | Status | Architectural Analysis & Conflict Resolution |
|---|---|---|---|---|
| **Homepage Structure** | `LuxuryStorefront.tsx` (Hardcoded React JSX) | PostgreSQL CMS (`cms_page.blocks->published_config->sections`) | ⚠️ **CONFLICT / BYPASS** | `(store)/page.tsx` fetches CMS data from PostgreSQL, but `<LuxuryStorefront>` ignores `sections`. Must restore `<PageRenderer>` as canonical structure. |
| **Hero Section** | Hardcoded text in `LuxuryStorefront.tsx` | PostgreSQL CMS (`cmspg_home` section `hero` / `scrollSequenceFrames`) | ⚠️ **CONFLICT** | Hero copy ("Crafted in Bangalore", "Modern Patisserie") is currently static in JSX. Must be driven by CMS `hero` section config with luxury styling. |
| **Hero Scroll Frames** | Stored in PostgreSQL `cms_page` (`sec_hero_root`) | PostgreSQL CMS (`cms_page.blocks->sections`) | ⚠️ **BYPASS IN STOREFRONT** | Scroll frame sequence (22 WebP frames) exists in DB but is not rendered on homepage because `LuxuryStorefront` is rendered instead. |
| **Products & Merchandising** | Filtered from PostgreSQL `listProducts()` | PostgreSQL Product Data (`ProductRepository.findAll` + `branch_inventory`) | ⚠️ **PARTIAL** | Products are fetched from PostgreSQL, but section assignments (which products appear in which section) are hardcoded in `LuxuryStorefront` instead of CMS `resolveProducts`. |
| **Product Prices** | PostgreSQL `product.metadata->>'selling_price'` | PostgreSQL `product.metadata->>'selling_price'` | ✅ **ALIGNED** | Selling prices come directly from PostgreSQL database. Zero hardcoded prices. |
| **Product Inventory & Stock** | PostgreSQL `branch_inventory` table | PostgreSQL `branch_inventory` (`InventoryService.getBatchStock`) | ✅ **ALIGNED** | Batch stock resolution respects branch ID and pincode isolation. Zero memoryStore stock authority. |
| **Categories & Taxonomy** | PostgreSQL `product_category` table | PostgreSQL (`listPimCategories` querying `product_category` + `product`) | ⚠️ **PARTIAL** | Categories exist in PostgreSQL, but `LuxuryStorefront` renders a hardcoded slice of categories. Must use CMS `category_grid` / `category_carousel` sections. |
| **Occasions Discovery** | PostgreSQL `product.metadata->>'occasion'` | PostgreSQL (`listOccasions`) | ⚠️ **PARTIAL** | Occasions are derived from DB, but `LuxuryStorefront` renders static occasion cards. Must be driven by CMS `occasions_grid` section. |
| **Promotional Offers** | PostgreSQL `offers` table | PostgreSQL (`OfferRepository.findAll`) | ✅ **ALIGNED** | Sourced from PostgreSQL via `listPublicOffers`. |
| **Branch Resolution** | Cookie `_cth_branch_id` + `_cth_pincode` via `BranchRepository` | PostgreSQL `branch` table (`BranchRepository.findByPincode`) | ✅ **ALIGNED** | Real-time branch resolution against PostgreSQL database. |
| **Pincode Serviceability** | PostgreSQL `delivery_zone` / `branch` | PostgreSQL database | ✅ **ALIGNED** | Serviceability evaluated against PostgreSQL delivery zones. |
| **SEO & OpenGraph** | PostgreSQL `cms_page.meta_title`, `meta_description`, `og_image` | PostgreSQL CMS (`cms_page` table) | ✅ **ALIGNED** | `generateMetadata()` in `page.tsx` reads directly from PostgreSQL `cms_page`. |
| **Section Animations** | Hardcoded Framer Motion variants in `LuxuryStorefront` | CMS Configuration (`SectionMotionWrapper` + `ScrollFrameHero`) | ⚠️ **CONFLICT** | `SectionMotionWrapper` supports `fade_up`, `fade_down`, `slide_left`, `slide_right`, `scale`, `reveal`. CMS section animation config must control storefront animations. |
| **Theme & Typography** | Hardcoded Tailwind classes in `LuxuryStorefront` | CMS Theme Configuration (`theme.bg_color`, `heading_font`, `font_family`) | ⚠️ **PARTIAL** | Page theme tokens exist in CMS schema (`theme`), but `PageRenderer` previously defaulted to light styles. Must apply luxury tokens (`#0c1326`, Playfair) as default theme. |
| **Call-To-Actions (CTAs)** | Hardcoded `<Link href="/products">` in `LuxuryStorefront` | CMS Configuration (`sec.config.primary_cta_url`, etc.) | ⚠️ **CONFLICT** | CTA destinations must be administrator-editable via CMS section configuration. |
| **Draft / Preview** | PostgreSQL `cms_page` (`draft_config` & `sections`) | PostgreSQL CMS (`PageConfigurator` -> `<PageRenderer isPreview={true}>`) | ✅ **ALIGNED** | Admin canvas preview renders live draft state. |
| **Publishing State** | PostgreSQL `cms_page` (`published_config`) | PostgreSQL CMS (`status = 'published'`, `published_at = NOW()`) | ✅ **ALIGNED** | Atomic publishing persists frozen configuration into PostgreSQL JSONB. |
| **Version History** | PostgreSQL `cms_page.blocks->version_history` | PostgreSQL CMS (Max 5 snapshots, frame arrays stripped) | ✅ **ALIGNED** | Stored in PostgreSQL with frame bloat protection. |
| **Rollback Operation** | PostgreSQL `cms_page` | PostgreSQL CMS (`ApiEngine.rollbackCmsPage`) | ✅ **ALIGNED** | Restores snapshot into draft state and persists to database. |

---

## 2. Identified Architectural Conflicts & Remediation Plan

### Conflict 1: Storefront Render Bypass
- **The Issue**: In commit `9bda4a8`, `(store)/page.tsx` was modified to directly render `<LuxuryStorefront>`, abandoning the CMS section rendering engine (`PageRenderer`).
- **Remediation**: Revert the JSX output in `(store)/page.tsx` to render `<PageRenderer>`, passing the authoritative server-fetched CMS sections and catalog datasets.

### Conflict 2: Hardcoded vs. CMS-Driven Visual Aesthetic
- **The Issue**: The luxury patisserie styling (navy background `#0c1326`, gold accents `#D4AF37`, Playfair serif typography, luxury card borders, pill buttons) was implemented inside `LuxuryStorefront` instead of `PageRenderer`.
- **Remediation**: Port the visual design language into `PageRenderer` and its child section renderers (`Hero`, `CategoryGrid`, `ProductGrid`, `BrandStory`, `OccasionsGrid`, `Features`, `TrustBadges`), ensuring all copy, images, and collections remain CMS-configurable.

### Conflict 3: Scroll Sequence vs. Static Hero
- **The Issue**: PostgreSQL `cmspg_home` contains an active 22-frame WebP scroll sequence in section `sec_hero_root`, while `LuxuryStorefront` rendered a static Unsplash hero image.
- **Remediation**: In `PageRenderer`, seamlessly support both modes:
  - When `config.disable_scroll_sequence !== true` and frames are present: Render `<ScrollFrameHero>` with luxury typography and gold badge overlays.
  - When `config.disable_scroll_sequence === true` or frames are absent: Render the luxury static patisserie hero with Playfair serif typography, italic accent, and gold pill CTAs.

### Conflict 4: Product Merchandising Authority
- **The Issue**: `LuxuryStorefront` filtered products using ad-hoc inline slicing (`allProducts.slice(0, 4)`).
- **Remediation**: Use `resolveProducts(config, allProducts)` in `PageRenderer`, allowing the CMS administrator to select product selection modes (`best_sellers`, `featured`, `new_arrivals`, `manual`, `category`) while sourcing product pricing and branch inventory strictly from PostgreSQL.
