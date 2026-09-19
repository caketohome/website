# Checkpoint 00: Forensic Audit & Authority Matrix

> **Phase**: Phase 0  
> **Status**: Completed  
> **Reference Artifacts**:  
> - [docs/homepage-cms-audit.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/homepage-cms-audit.md)  
> - [docs/homepage-cms-authority-matrix.md](file:///e:/vig/cakes2home-main/cakes2home-main/docs/homepage-cms-authority-matrix.md)

---

## 1. Summary of Findings

1. **The Storefront Bypass Defect**:
   - `frontend/src/app/(store)/page.tsx` was modified in commit `9bda4a8` to render `<LuxuryStorefront>` instead of `<PageRenderer>`.
   - `<LuxuryStorefront>` ignored all CMS sections fetched from PostgreSQL and rendered hardcoded strings ("Crafted in Bangalore", "Modern Patisserie", static category slice, etc.).
   - This broke the link between CMS administrator publishing in `PageConfigurator` and the customer-facing storefront homepage.

2. **Existing CMS Engine Capabilities**:
   - Central section registry: `frontend/src/lib/cms/section-registry.ts` has 125 registered sections across 12 categories.
   - Central renderer: `frontend/src/components/store/cms/page-renderer.tsx` (3,442 lines) already supports all 125 section types, including dynamic product resolution (`resolveProducts`), `ScrollFrameHero`, `split_hero`, and `SectionMotionWrapper`.
   - Admin builder: `frontend/src/components/dashboard/admin/page-configurator.tsx` (1,460 lines) has drag/reorder, duplication, section enable/disable, preview across viewport sizes, save draft, publish, unpublish, version history, and rollback.

3. **Data Pipelines & Database Authority**:
   - PostgreSQL is the sole authoritative store.
   - `cms_page` stores pages with JSONB `blocks` (`sections`, `draft_config`, `published_config`, `version_history`).
   - `product` stores catalog items with `selling_price` and metadata.
   - `branch_inventory` stores branch-specific stock, queried in batch via `InventoryService.getBatchStock`.
   - `product_category` stores category taxonomy, joined with `product`.
   - Zero reliance on memoryStore or static JSON as runtime authority.

4. **Animations**:
   - `ScrollFrameHero`: High-performance HTML5 canvas scroll scrub engine with multi-device WebP frame sequences.
   - `SectionMotionWrapper`: IntersectionObserver-based GPU CSS transforms (`translate3d`, `opacity`, `cubic-bezier(0.16, 1, 0.3, 1)`).
   - Both engines support `prefers-reduced-motion: reduce`.

5. **The Missing Piece**:
   - The luxury patisserie visual styling (`#0c1326`, `#142040`, `#D4AF37`, Playfair serif typography, luxury card borders, pill buttons) needs to be integrated directly into `PageRenderer` so that the CMS-rendered homepage achieves the aesthetic while remaining 100% database-backed and administrator-configurable.

---

## 2. Gate Verification Sign-Off
- [x] Full forensic code trace completed.
- [x] PostgreSQL connection and schema verified.
- [x] Both local servers (3000 and 9000) verified operational.
- [x] Zero source code changes made to production logic in Phase 0.
- [x] Audit report and authority matrix completed and committed to disk.
- [x] Phase 0 complete and verified. Ready for Phase 1.
