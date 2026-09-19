# CakeToHome — Homepage Premium Redesign & CMS Page Builder Audit (Phase 0)

**Date**: 2026-09-11  
**Project**: CakeToHome  
**Primary Brand Anchor**: `#1D2F5D` (Deep Navy / Royal Patisserie)  
**Database Authority**: PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Status**: COMPLETED AUDIT (GATE FOR PHASE 1 EXECUTION)

---

## 1. Current Homepage Render Path

The customer storefront homepage executes through the canonical Next.js dynamic App Router route at `frontend/src/app/(store)/page.tsx`.

```text
Storefront Browser Request (/)
        ↓
Next.js SSR / Server Component (frontend/src/app/(store)/page.tsx)
        ↓
Pincode & Branch Context Cookie Evaluation (_cth_branch_id, _cth_pincode)
        ↓
Concurrent Data Fetching via Promise.all:
  ├─ getHomepage() [frontend/src/lib/data/cms.ts]
  ├─ listProducts({ branchId, pincode }) [frontend/src/lib/data/catalog.ts]
  ├─ listPimCategories() [frontend/src/lib/data/catalog.ts]
  └─ listOccasions() [frontend/src/lib/data/catalog.ts]
        ↓
PostgreSQL Query via CmsRepository.findPageBySlug('home') [frontend/src/lib/repositories/cms.repository.ts]
        ↓
Published Configuration Extraction:
  • If status === 'published', sections are loaded strictly from page.published_config.sections.
  • Draft configuration (page.draft_config) is never exposed on the public storefront.
        ↓
Canonical PageRenderer Component [frontend/src/components/store/cms/page-renderer.tsx]
        ↓
Section Registry Resolution & Dynamic Rendering:
  • Section 1: ScrollFrameHero (canvas 22-frame scrubbing) / StaticHero
  • Section 2: Signature Collections (category_grid)
  • Section 3: Featured / Bestseller Products (product_grid)
  • Section 4: Occasion Discovery (occasions_grid)
  • Section 5: Trust & Features (features)
  • Section 6: Bespoke / Call-to-Action (cta / split_hero)
```

**Verification Highlights**:
- The homepage is 100% CMS-driven via `<PageRenderer>`.
- Zero bypass: The previous hardcoded `<LuxuryStorefront>` bypass was fully retired in favor of `<PageRenderer>`.
- Fallback protection: If no sections are published, `<StorefrontProductHomepage>` provides a safe fallback catalog.

---

## 2. Current CMS Render Path

The CMS Page Builder is loaded inside the administrative dashboard:

```text
Admin Browser Request (/dashboard?tab=cms or /admin/cms)
        ↓
Dashboard Controller [frontend/src/app/dashboard/page.tsx]
        ↓
Dynamic CMS Panel [frontend/src/components/dashboard/admin/cms-panel.tsx]
        ↓
PageConfigurator Component [frontend/src/components/dashboard/admin/page-configurator.tsx]
        ↓
apiClient.getCmsPages() & apiClient.getCmsPage('cmspg_home') [frontend/src/lib/api-client.ts]
        ↓
API Proxy Route (/api/v1/cms/pages) [frontend/src/app/api/v1/[...path]/route.ts]
        ↓
CmsRepository.findAllPages() / CmsRepository.findPageBySlug()
        ↓
PostgreSQL Table: public.cms_page
        ↓
PageConfigurator State:
  • editingPage: loaded with draft_config and active section layout
  • Live preview iframe / center canvas embeds canonical <PageRenderer isPreview={true}>
```

---

## 3. Current PostgreSQL Source-of-Truth Path

1. **Table Structure**:
   - `public.cms_page`: Primary key `id` (`text`), `title`, `slug`, `type`, `status` (`draft` | `published` | `archived`), `meta_title`, `meta_description`, `canonical_url`, `og_image`, `blocks` (`jsonb`), `created_at`, `updated_at`, `published_at`, `deleted_at`.
2. **Authoritative Storage**:
   - `blocks` JSONB column stores:
     - `sections`: Array of configured sections for editing.
     - `theme`: Global page theme object (`bg_color`, `text_color`, `heading_font`, `accent_color`, `card_style`).
     - `draft_config`: Working draft state containing unpublished sections, banners, and filters.
     - `published_config`: Frozen production snapshot applied only on explicit Publish action.
     - `version_history`: Reversible audit snapshots for one-click rollback.
3. **Draft / Publish Isolation**:
   - Save Draft updates `blocks.sections`, `blocks.draft_config`, and `status = 'draft'` in PostgreSQL.
   - Publish takes the validated draft configuration, freezes it into `blocks.published_config`, sets `status = 'published'`, and assigns `published_at = NOW()`.
   - The public storefront `getHomepage()` queries `blocks.published_config`. Thus, ongoing draft edits do not leak to customers until published.
4. **No Fallback to Stale Memory**:
   - Server-side data fetching directly queries `CmsRepository` on PostgreSQL.

---

## 4. Existing Scroll Animation Architecture

The scroll frame animation is implemented in `frontend/src/components/store/animation/scroll-frame-hero.tsx` and dynamically rendered via `ScrollFrameHero`:

1. **Asset Source**:
   - 22 high-resolution WebP frames stored in PostgreSQL `cmspg_home.blocks.sections[0].config.desktop.frames` (e.g. `frame-01.webp` through `frame-22.webp`).
2. **Rendering Engine**:
   - HTML5 `<canvas>` with device-pixel-ratio scaling (`window.devicePixelRatio`).
   - RequestAnimationFrame scrubbing loop linked to container scroll progress (`scrollY / scrollLength`).
   - Preload queue with priority indexing (poster frame 1 first, keyframes next, remaining frames in background).
   - Smoothing interpolation with cubic easing (`scrub_smoothing`).
3. **Multi-Device Support**:
   - Device detection (`desktop`, `tablet`, `mobile`).
   - Supports device-specific frame sets (`desktop.frames`, `tablet.frames`, `mobile.frames`) or responsive scaling.
4. **Resilience & Accessibility**:
   - `prefers-reduced-motion: reduce` detection automatically falls back to a high-fidelity static poster.
   - If canvas context fails or images fail to load, graceful fallback to `poster_image`.
   - Zero memory leak: cleanup callbacks revoke image references and cancel animation frames on unmount.

---

## 5. Existing Page Builder Capabilities

The current `PageConfigurator` (`frontend/src/components/dashboard/admin/page-configurator.tsx`) provides:
1. **Page Selection**: Switch between pages (`cmspg_home`, catalog, landing pages).
2. **Section Operations**:
   - Add new section from registry.
   - Reorder sections via drag-and-drop or up/down arrows.
   - Duplicate section.
   - Remove section.
   - Toggle section visibility (`enabled: true/false`).
3. **Specialized Section Editors**:
   - `ScrollFrameEditor`: Manage frames, preload strategy, hold percentages, and scroll duration.
   - `ProductGridEditor`: Select query mode (best sellers, new arrivals, manual selection), grid columns, density, badges.
   - `OccasionsGridEditor`: Select occasion cards, layout styles.
   - `FeaturesSectionEditor`: Edit trust badges and warranty claims.
   - `SplitHeroEditor`: Configure headline, body, CTA, and image alignment.
4. **Global Tabs**:
   - General (titles, slugs), PDP, SEO (meta tags, robots, structured data), Theme (colors, fonts), Visibility (device/location rules), Advanced.
5. **Publish & Rollback**:
   - Save Draft to PostgreSQL.
   - Publish to PostgreSQL with validation.
   - Version History modal with one-click rollback.

---

## 6. Existing CMS Schema

The central section schema (`frontend/src/lib/cms/section-registry.ts` and `section-schema.ts`) defines:

1. **Section Types**:
   - `hero`, `hero_video`, `split_hero`, `scroll_story`
   - `product_grid`, `product_carousel`, `product_spotlight`
   - `category_grid`, `category_carousel`, `category_explorer`
   - `occasions_grid`, `occasion_carousel`
   - `features`, `trust_badges`, `testimonials`
   - `brand_story`, `timeline`, `quote`
   - `cta`, `deal_banner`, `delivery_coverage`, `enquiry_form`
2. **Shared Config Properties**:
   - Layout: `full_width`, `padding_y`, `margin_y`, `container_width`
   - Style: `bg_color`, `text_color`, `heading_color`, `accent_color`, `card_style`
   - Animation: `type` (`fade_up`, `fade_down`, `slide_left`, `slide_right`, `scale`, `reveal`, `none`), `duration`, `delay`, `trigger`
   - Device Visibility: `hide_desktop`, `hide_tablet`, `hide_mobile`

---

## 7. Existing Reusable UI Components

1. **Atoms & Primitives**:
   - `@medusajs/ui`: `Button`, `Heading`, `Text`, `Badge`, `Input`, `Label`, `Textarea`, `Select`, `Container`.
   - `lucide-react`: Complete icon suite.
2. **Storefront Shared Components**:
   - `SectionMotionWrapper`: IntersectionObserver viewport entrance animator with reduced-motion support.
   - `CarouselContainer`: Touch/swipe responsive carousel with autoplay, pause-on-hover, arrow and dot navigation.
   - `BeforeAfterSlider`: Interactive drag slider for baking transformation comparisons.
   - `InteractiveLeadForm`: Real-time custom cake enquiry submission connected to `/api/v1/enquiries`.
   - `ProductCard`: Interactive card with wishlist, weight selector, dynamic price display, and Quick-Add drawer.
   - `ScrollFrameHero`: 22-frame high-performance canvas scrubbing engine.

---

## 8. Current Limitations

1. **Visual System & Color Cohesion**:
   - Dark mode styles and light mode cards previously had inconsistent background blending.
   - Lack of a centralized brand color token palette anchoring `#1D2F5D`.
   - Typography lacked luxury patisserie hierarchy (needs refined contrast between `Playfair Display` serif headings and `Plus Jakarta Sans`/`Inter` sans body).
2. **Page Composition & Customer Journey**:
   - Sections were somewhat disconnected blocks without a cohesive narrative flow from Brand Introduction → Signature Collections → Bestsellers → Bespoke Ordering → Trust → Social Proof → Final Conversion CTA.
3. **CMS Page Builder Experience**:
   - The Page Builder was packed into a dense vertical layout where section listing, form fields, and preview competed for screen real estate.
   - Lacked a modern 3-panel studio layout (Left: Layer tree / section navigator, Center: Interactive responsive canvas preview, Right: Contextual accordion inspector).
   - Hero animation controls in CMS were primarily frame-focused; lacked intuitive controls for editorial fallback mode, badge styling, overlay gradient, and story-phase text overlays.
4. **Data Source Integration**:
   - Some section editors lacked intuitive product/category search pickers.

---

## 9. Proposed Redesign Architecture

### A. Central Brand System (`#1D2F5D`)
- **Primary Brand Anchor**: `#1D2F5D` (Midnight Royal Navy).
- **Secondary Palette**: Warm cream (`#FDFBF7`), Pure White (`#FFFFFF`), Slate Soft (`#F1F5F9`), Antique Gold (`#D4AF37` / `#C5A059`), Rose Accent (`#B76E79`).
- **Section Contrast Rhythm**: Controlled cadence across the page:
  - Hero: Deep Navy `#1D2F5D` with gold accents and canvas animation.
  - Signature Collections: Warm Cream `#FDFBF7` with tactile category cards.
  - Bestseller Showcase: Pure White `#FFFFFF` with high-contrast product photography and pricing.
  - Occasion Journey: Soft slate `#F8FAFC` with festive badges.
  - Brand Craft Story: Deep Navy `#1D2F5D` with artisanal bakery imagery.
  - Trust & Fresh Delivery: Warm Cream `#FDFBF7` with verified service metrics.
  - Bespoke Custom Cake Concierge: Soft ivory `#FFFDF9` with customisation step builder.
  - Social Proof / Testimonials: Pure White `#FFFFFF` with genuine customer quotes and ratings.
  - Final Conversion CTA: Majestic Royal Navy `#1D2F5D` with dual high-conversion CTAs.

### B. Upgraded Section Library
- **Hero**: Unified controller supporting both 22-frame `ScrollFrameHero` scrubbing and Editorial Hero mode with zero code duplication.
- **Signature Collections**: Luxury cards with subtle zoom, item count badges, and direct catalog deep links.
- **Featured / Bestseller Products**: Dynamic PostgreSQL-backed grid/carousel with realtime prices, weight variations, and quick-add.
- **Occasion Discovery**: Curated occasion cards (Birthday, Anniversary, Romance, Corporate, Midnight).
- **Editorial Brand Story**: Split layout with chef craftsmanship story, ingredient callouts, and heritage quote.
- **Trust & Delivery Confidence**: Real operational metrics (temperature-controlled delivery, 2-hour rush dispatch, 100% fresh bake).
- **Bespoke / Custom Cake Studio**: Multi-step customization guide and direct WhatsApp/enquiry booking modal.
- **Social Proof**: Curated customer testimonials with verified badges and rating stars.
- **Final Conversion CTA**: High-impact banner with pincode delivery checker and shopping CTA.

### C. 3-Panel Studio Page Builder (`PageConfigurator`)
- **Left Panel (Page Navigator)**:
  - Visual layer tree of all sections with icons, enabled toggles, drag reorder handles, move up/down buttons, duplicate, and delete.
  - Add Section button with categorized modal.
- **Center Panel (Live Studio Canvas)**:
  - Device switcher (Desktop 1440px, Tablet 768px, Mobile 375px).
  - Selected section highlight outline and quick navigation.
  - Real-time rendering of `<PageRenderer isPreview={true}>`.
- **Right Panel (Contextual Section Inspector)**:
  - Grouped accordion tabs: Content, Media, Layout, Style, CTA, Data Source, Animation, Responsive.
  - Full controls for both Scroll Animation parameters and Editorial Hero options.
- **Top Studio Bar**:
  - Page title, slug, draft/publish status badge, unsaved changes indicator, Save Draft, Preview in New Tab, Publish (with confirmation), and Version History / Rollback.

---

## 10. Identified Risks & Mitigation Strategies

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Overwriting or breaking the 22-frame scroll animation | Severe storefront regression | Keep `scroll-frame-hero.tsx` and frame assets untouched. Only enhance CMS configuration controls and wrap safely in `<PageRenderer>`. |
| Loss of PostgreSQL source of truth | Severe data inconsistency | Ensure all reads query `CmsRepository` on PostgreSQL and all writes go through `persistCmsPageToDb`. |
| Breaking draft / publish isolation | Draft content leaking to live site | Maintain strict check: storefront renders `blocks.published_config.sections`, while builder edits `blocks.draft_config.sections`. |
| Performance degradation from heavy assets | Slow page load & high LCP | Lazy-load below-the-fold media, preload only poster + early frames for hero, keep all product queries bounded and batched. |
| Mobile layout clipping or horizontal scroll | Poor mobile UX | Enforce `overflow-x-clip`, touch-friendly minimum 44px tap targets, and tested responsive breakpoints. |

---

## 11. Exact Implementation Phases

- **Phase 1: Design Tokens and Primitives (`#1D2F5D`)**
  - Configure unified semantic design tokens in Tailwind and CSS.
  - Create reusable typography, button, badge, and section container primitives.
- **Phase 2: Premium Homepage Section Implementations**
  - Upgrade the 9 core sections in `page-renderer.tsx` to luxury patisserie quality.
  - Enhance Hero with seamless Scroll-Scrub / Editorial mode toggling.
- **Phase 3: CMS Schema & Configuration Alignment**
  - Ensure all new section options are additively registered in `section-registry.ts`.
- **Phase 4: Complete CMS Page Builder 3-Panel Redesign**
  - Redesign `page-configurator.tsx` with Left Layer Tree, Center Responsive Canvas, and Right Contextual Inspector.
- **Phase 5: PostgreSQL Source-of-Truth & Lifecycle Verification**
  - Execute automated tests for Draft Save, Preview, Publish, Rollback, and dynamic catalog reads.
- **Phase 6: Conversion UX & Psychology Polish**
  - Verify first-screen clarity, CTA hierarchy, trust signals, and responsive ergonomics.
- **Phase 7: Full Verification & Quality Gate**
  - Run TypeScript compiler checks, browser tests across Desktop, Tablet, and Mobile, and verify zero console/network errors.

---

*Audit completed and certified against CakeToHome engineering standards.*
