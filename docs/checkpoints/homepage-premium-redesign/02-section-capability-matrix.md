# CakeToHome — Section Capability Matrix (Phase 2 Architectural Mapping)

**Date**: 2026-09-11  
**Status**: VERIFIED & MAPPED  
**Objective**: Inspect actual section registry, renderers, editors, and schemas in the codebase to determine exact capability mapping for the 9 premium homepage sections.

---

## Section Capability Mapping Table

| Section Candidate | Existing Section Type | Current Renderer Location | Current Editor Location | Central Schema Support | Strategy (REUSE / EXTEND / CREATE) | Key Technical Requirements & Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Premium Hero** | `hero` | `page-renderer.tsx` (L976–L1150) | `section-config-editor.tsx` + `scroll-frame-editor.tsx` | Supported (`section-registry.ts:159`) | **EXTEND** | **Strategy**: Dual-mode rendering: Scrubbing `ScrollFrameHero` when enabled, luxury editorial hero (`Playfair Display`, badge, gold highlights, dual CTAs) when disabled.<br>**Risk**: LOW. Must preserve canvas scrubbing engine and 22 desktop frames. |
| **2. Scroll Animation Hero** | `hero` (`scroll_frame`) | `scroll-frame-hero.tsx` (L1–L1107) | `scroll-frame-editor.tsx` (L1–L1178) | Supported (`hero.desktop.frames`) | **REUSE** | **Strategy**: Reuse the 22-frame canvas scrubbing engine without mutating frames.<br>**Risk**: LOW. Keep desktop frame set in `cmspg_home` intact. |
| **3. Signature Collections** | `category_grid` / `category_carousel` | `page-renderer.tsx` (L1555–L1674) | `section-config-editor.tsx` (category selector) | Supported (`section-registry.ts:361`) | **EXTEND** | **Strategy**: Connect to PostgreSQL `allCategories`, add warm cream `#FDFBF7` surface, item count badges, gold accent pills, and smooth zoom hover.<br>**Risk**: LOW. Dynamic data already connected. |
| **4. Featured Products** | `product_grid` / `product_carousel` | `page-renderer.tsx` (L1920–L2394) | `product-grid-editor.tsx` | Supported (`section-registry.ts:251`) | **EXTEND** | **Strategy**: Upgrade card styling to luxury patisserie standards: crisp white surface, gold rating stars `#D4AF37`, weight selector, real-time MRP discount, and `#1D2F5D` quick-add drawer.<br>**Risk**: LOW. Prevent N+1 queries by reusing `resolveProducts`. |
| **5. Bestseller Products** | `product_grid` (`mode: best_sellers`) | `page-renderer.tsx` (L1920–L2394) | `product-grid-editor.tsx` (`mode: best_sellers`) | Supported | **REUSE** | **Strategy**: Shares the upgraded `product_grid` component with automatic query mode sorting and "Bestseller" ribbon badge.<br>**Risk**: LOW. |
| **6. Occasion Discovery** | `occasions_grid` / `occasion_carousel` | `page-renderer.tsx` (L1675–L1919) | `occasions-grid-editor.tsx` | Supported (`section-registry.ts:435`) | **EXTEND** | **Strategy**: Connect to PostgreSQL `occasions` catalog (Birthday, Anniversary, Romance, etc.), soft slate `#F8FAFC` background, festive badge pills.<br>**Risk**: LOW. Uses authoritative DB occasions. |
| **7. Editorial Brand Story** | `brand_story` / `split_hero` | `page-renderer.tsx` (L2395 & L1246) | `split-hero-editor.tsx` | Supported (`section-registry.ts:738` & `177`) | **EXTEND** | **Strategy**: Deep Royal Navy `#1D2F5D` background, antique gold quote highlights `#D4AF37`, chef craftsmanship story, dual imagery (raw single-origin cocoa to finished cake).<br>**Risk**: LOW. All text CMS-managed. |
| **8. Trust & Delivery Confidence** | `features` / `trust_badges` | `page-renderer.tsx` (L2480–L2650) | `features-section-editor.tsx` | Supported (`section-registry.ts:646`) | **EXTEND** | **Strategy**: Warm cream `#FDFBF7` section with genuine operational promises: 100% Eggless available, temperature-controlled chilled delivery, 2-hour rush baking, and live GPS tracking.<br>**Risk**: LOW. Zero fabricated claims. |
| **9. Bespoke / Custom Cake Studio** | `custom_cake_cta` / `custom_cake_enquiry` | `page-renderer.tsx` (L3001 & L3503) | `section-config-editor.tsx` (`InteractiveLeadForm`) | Supported (`section-registry.ts:608` & `1140`) | **EXTEND** | **Strategy**: Multi-step customization visualizer (Shape → Flavor → Tier → Message) with instant concierge enquiry connected to `/api/v1/enquiries` and WhatsApp.<br>**Risk**: LOW. Backend endpoint `/api/v1/enquiries` already exists. |
| **10. Social Proof (Testimonials)** | `testimonials` | `page-renderer.tsx` (L3316–L3400) | `section-config-editor.tsx` | Supported (`section-registry.ts:664`) | **EXTEND** | **Strategy**: Approved customer review cards with gold star rating `#D4AF37`, celebration badge (e.g. "25th Anniversary Cake"), and touch carousel.<br>**Risk**: LOW. CMS-managed testimonials; zero fake reviews. |
| **11. Final Conversion CTA** | `cta` / `deal_banner` | `page-renderer.tsx` (L2996–L3061) | `section-config-editor.tsx` | Supported (`section-registry.ts:518`) | **EXTEND** | **Strategy**: High-impact Royal Navy `#1D2F5D` banner with dual CTAs, gold accent button, and integrated pincode delivery checker.<br>**Risk**: LOW. |

---

## Architectural Decision Summary

1. **Zero New Database Migrations Needed**:
   - Every one of the 11 section requirements maps directly into existing section types or additive config keys inside PostgreSQL `cms_page.blocks`.
2. **Zero Hardcoded Bypasses**:
   - The canonical `PageRenderer` continues to be the single entry point for all storefront rendering.
3. **No Code Duplication**:
   - `ScrollFrameHero` is reused as the interactive animation engine.
   - `InteractiveLeadForm` is reused for bespoke cake concierge enquiries.
   - `CarouselContainer` and `SectionMotionWrapper` are reused across collections, occasions, and products.
4. **Primary Brand Anchor `#1D2F5D` Enforced**:
   - Contrast cadence alternates between Royal Navy, Warm Cream, Pure White, and Soft Slate to maintain a luxury patisserie rhythm.
