# CakeToHome — Complete Premium Homepage + CMS Page Builder Redesign Plan

This plan details the phased execution for redesigning both the customer-facing homepage and the administrative CMS Page Builder experience, establishing a luxury patisserie brand identity anchored in `#1D2F5D` while preserving the PostgreSQL database authority, the 22-frame canvas scroll animation engine, and the canonical `PageRenderer` architecture.

---

## User Review Required

> [!IMPORTANT]
> **Preservation of Existing Architecture & Database Authority**:
> - All homepage content continues to render via the canonical `<PageRenderer>` component.
> - PostgreSQL (`cms_page` table) remains the single authoritative source of truth.
> - The 22-frame desktop canvas scroll animation (`ScrollFrameHero`) is preserved intact and enhanced with both full CMS controls and an elegant editorial hero fallback when disabled.
> - No database tables will be dropped, truncated, or reseeded.
> - Git commit and push operations are strictly prohibited as instructed.

> [!NOTE]
> **Primary Brand Palette**:
> - Main brand colour: `#1D2F5D` (Royal Patisserie Navy).
> - Section contrast rhythm: Controlled alternation between deep navy, warm cream (`#FDFBF7`), crisp white product sections, soft slate, and antique gold accents (`#D4AF37`).

---

## Proposed Changes

### Component 1: Design Tokens & Styling Primitives (Phase 1)
Enhance Tailwind configuration and global styling tokens to anchor on `#1D2F5D` and provide semantic tokens for luxury typography, spacing, and surfaces.

#### [MODIFY] [frontend/tailwind.config.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/tailwind.config.ts)
- Add brand semantic color tokens:
  - `primary`: `#1D2F5D`
  - `primary-dark`: `#0F1A36`
  - `primary-light`: `#2A4380`
  - `primary-soft`: `#EAEFF8`
  - `cream`: `#FDFBF7`
  - `warm-white`: `#FAFAF9`
  - `surface-muted`: `#F4F5F7`
  - `gold-accent`: `#D4AF37`
  - `gold-soft`: `#F5E8C7`
- Extend typography hierarchy and shadow elevation tokens.

#### [MODIFY] [frontend/src/app/globals.css](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/globals.css)
- Add CSS variables and luxury class utilities:
  - `.bg-brand-primary`, `.text-brand-primary`, `.border-brand-primary`
  - `.bg-brand-cream`, `.bg-brand-warm-white`, `.text-gold-accent`
  - Card elevation tokens for both dark luxury and light editorial surfaces.

---

### Component 2: Premium Homepage Section Library (Phase 2)
Upgrade the canonical section renderer in `frontend/src/components/store/cms/page-renderer.tsx` to support the 9 luxury section types with premium aesthetics and responsive ergonomics.

#### [MODIFY] [frontend/src/components/store/cms/page-renderer.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/cms/page-renderer.tsx)
1. **Hero Section (`hero`)**:
   - Seamless dual-mode: 
     - **Mode A**: Scrubbing 22-frame `ScrollFrameHero` with sticky canvas scrubbing and overlay captions.
     - **Mode B**: Editorial luxury hero with high-impact typography (`Playfair Display`), badge, primary & secondary CTAs, delivery promise chip, and optional background video or image.
2. **Signature Collections (`category_grid` / `category_carousel`)**:
   - Luxury collection cards with subtle zoom, item count badges, warm cream backdrop, and smooth hover interactions.
3. **Featured / Bestseller Products (`product_grid` / `product_carousel`)**:
   - PostgreSQL-backed product cards with weight selector, real-time pricing, discount percentage badge, delivery slot indicator, and quick-add drawer.
4. **Occasion Discovery (`occasions_grid` / `occasion_carousel`)**:
   - Curated cards for Birthdays, Anniversaries, Romance, Weddings, Festivals, and Corporate gifting.
5. **Editorial Brand Story (`brand_story` / `split_hero`)**:
   - Artisanal storytelling section with chef craft philosophy, French & Indian fusion heritage, and ingredient quality seals.
6. **Trust & Delivery Confidence (`features` / `trust_badges`)**:
   - Real operational guarantees: 100% Eggless available, Chilled fleet delivery, Midnight delivery, Real-time GPS tracking.
7. **Bespoke / Custom Cake Studio (`bespoke_cake` / `custom_cakes`)**:
   - Customisation journey visualizer (Choose Shape → Flavor → Tier → Message) with instant concierge enquiry / WhatsApp integration.
8. **Social Proof & Approved Testimonials (`testimonials`)**:
   - Verified customer review carousel with customer name, occasion celebrated, purchased cake flavor, and star rating.
9. **Final Conversion CTA (`cta`)**:
   - High-contrast royal navy section (`#1D2F5D`) with gold accent CTA and delivery pincode locator.

---

### Component 3: CMS Section Registry & Schema (Phase 3)
Additively expand schema definitions so all newly supported properties can be inspected and validated without breaking existing pages.

#### [MODIFY] [frontend/src/lib/cms/section-registry.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/cms/section-registry.ts)
- Register additive schema keys for editorial hero, story phases, custom cake studio steps, and testimonial cards.

---

### Component 4: Complete CMS Page Builder 3-Panel Studio Redesign (Phase 4)
Redesign `frontend/src/components/dashboard/admin/page-configurator.tsx` and related sub-editors into a professional visual site builder studio.

#### [MODIFY] [frontend/src/components/dashboard/admin/page-configurator.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/page-configurator.tsx)
- **Top Studio Bar**:
  - Live status indicator (Draft vs Published), last saved timestamp, device switchers (Desktop 1440px / Tablet 768px / Mobile 375px), Save Draft button, Preview button, Publish button (with validation modal), Version History / Rollback trigger.
- **Left Panel (Page Navigator / Layer Tree)**:
  - List of all page sections with section icon, section type tag, title, and enabled/disabled toggle.
  - Drag-and-drop reordering + accessible Up/Down move buttons.
  - Section actions: Duplicate, Delete, Visibility toggle.
  - High-visibility "Add Section" button with categorized modal.
- **Center Panel (Interactive Live Canvas)**:
  - Realistic responsive viewport container simulating desktop, tablet, and mobile displays.
  - Live embedding of canonical `<PageRenderer isPreview={true}>`.
  - Blue outline highlight on currently active/selected section with scroll-into-view.
- **Right Panel (Contextual Section Inspector)**:
  - Grouped accordion tabs:
    - **Content**: Eyebrows, headlines, subheadlines, badges, descriptions.
    - **Media**: Desktop, tablet, and mobile image/video pickers.
    - **Layout & Spacing**: Grid vs carousel, padding, container width, column count.
    - **Style & Colors**: Background theme selector, custom hex pickers for `#1D2F5D`, gold accents, card style variants.
    - **Call-to-Action**: Primary and secondary CTA labels, URLs, and style variants with link validation.
    - **Data Source**: Category selector, product mode (bestsellers, featured, manual picker).
    - **Animation**: Scroll scrubbing controls, entrance effects, duration, easing.

#### [MODIFY] [frontend/src/components/dashboard/admin/section-config-editor.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/section-config-editor.tsx)
- Integrate grouped accordion panels and clean input controls for all 9 section types.

---

### Component 5: Database Source of Truth & Verification (Phase 5 - 7)
Ensure draft isolation, preview safety, publish durability, rollback integrity, and dynamic catalog reads.

#### [NEW] [docs/checkpoints/homepage-premium-redesign/01-design-system.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/01-design-system.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/02-homepage-sections.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/02-homepage-sections.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/03-cms-schema.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/03-cms-schema.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/04-page-builder.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/04-page-builder.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/05-source-of-truth.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/05-source-of-truth.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/06-conversion-ux.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/06-conversion-ux.md)
#### [NEW] [docs/checkpoints/homepage-premium-redesign/07-verification.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/checkpoints/homepage-premium-redesign/07-verification.md)

---

## Verification Plan

### Automated Verification
1. **PostgreSQL Connectivity Check**:
   - Execute direct query check (`SELECT 1`, verify `cms_page` count and schema).
2. **TypeScript Compiler Check**:
   - Frontend: `node backend/node_modules/typescript/bin/tsc -p frontend/tsconfig.json --noEmit`
   - Backend: `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit`
3. **Database Source-of-Truth & Lifecycle Suite**:
   - Run end-to-end draft save, preview, publish, and rollback cycle verification script.
   - Verify that draft edits in PostgreSQL do not leak to public storefront `getHomepage()`.
   - Verify that dynamic products, categories, and occasions are loaded from PostgreSQL.

### Manual & Visual Verification
1. **Storefront Browser Verification**:
   - Inspect desktop view (1440px) for luxury brand presentation, `#1D2F5D` brand harmony, and smooth hero scroll scrubbing.
   - Inspect tablet view (768px) and mobile view (375px) for responsive ergonomics, readable headings, and touch tap targets.
2. **CMS Page Builder Studio Verification**:
   - Verify 3-panel studio layout: Left section list, Center responsive live canvas, Right contextual inspector.
   - Test section reordering, duplication, visibility toggle, and configuration updates.
   - Test switching between Desktop, Tablet, and Mobile canvas modes.
   - Test Save Draft, Preview, and Publish actions.
