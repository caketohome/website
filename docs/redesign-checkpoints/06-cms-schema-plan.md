# Checkpoint 06: CMS & Page Builder Schema Plan

- **Checkpoint ID**: `CP-06-CMS`
- **Date**: 2026-09-11
- **Current Phase**: Phase 3 (CMS / Page Builder Expansion)
- **Status**: `PRODUCTION-READY (CURRENT ARCHITECTURE)`
- **Risk Level**: Low

---

## 1. CMS Architecture & Data Model

CakeToHome's CMS is decoupled into an **Editorial Layer** (managed by marketing and store operators) and an **Authoritative Business Engine** (enforced by PostgreSQL and backend services).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      CakeToHome CMS Architecture                        │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ├── Studio Configurator (/dashboard?tab=cms)
        │     ├── 3-Panel Workspace:
        │     │     ├── Left: Layer Tree & Section Navigator (Filters, Drag-Reorder, Quick Actions)
        │     │     ├── Center: Interactive Responsive Studio Canvas (375px / 768px / 1100px / Full)
        │     │     └── Right: Contextual Property Inspector (Section Editor or Page Settings)
        │     ├── Theme Engine with 1-Click "✨ Luxury Midnight & Gold" (#1D2F5D) Preset
        │     └── Version History & Rollback Modal (PostgreSQL-backed snapshots)
        │
        ├── PostgreSQL Storage Layer (cms_pages table)
        │     ├── draft_config: jsonb (Active work-in-progress layout)
        │     ├── published_config: jsonb (Public storefront layout)
        │     ├── version_history: jsonb (Array of published snapshot revisions)
        │     └── sections: jsonb (Denormalized current sections)
        │
        └── Runtime Storefront Renderer (PageRenderer.tsx)
              ├── Renders only validated, published sections
              ├── Dynamic Hydration: Live DB prices, branch stock, active coupons
              └── Preserves 22-frame desktop canvas ScrollFrameHero engine
```

---

## 2. Page & Section Schema Definitions

### 2.1 Page Schema (`cms_pages`)
```typescript
interface CmsPage {
  id: string;                      // e.g. "cmspg_home"
  title: string;                   // "Home Page"
  slug: string;                    // "home" (root /)
  url_path: string;                // "/"
  page_type: "home" | "catalog" | "product" | "landing" | "campaign";
  status: "draft" | "published";
  h1: string;
  subheading: string;
  intro_content: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  og_image: string;
  twitter_card: string;
  theme: {
    bg_color: string;             // Navy radial gradient or crisp white
    text_color: string;
    heading_color: string;
    accent_color: string;         // Gold #D4AF37 or Crimson #E11D48
    font_family: string;          // 'Plus Jakarta Sans'
    heading_font: string;         // 'Playfair Display'
    card_style: "default" | "luxury" | "bordered";
  };
  announcement_bar?: {
    enabled: boolean;
    text: string;
    link_url?: string;
    bg_color?: string;
  };
  sections: SectionInstance[];
  published_config?: any;
  version_history?: PageVersionSnapshot[];
  updated_at: string;
}
```

### 2.2 Section Instance Schema
```typescript
interface SectionInstance {
  id: string;                      // e.g. "sec_1789100780464"
  type: string;                    // e.g. "scroll_frame_hero", "category_grid"
  name: string;                    // "Hero Scroll Canvas"
  enabled: boolean;                // Visibility toggle
  order: number;                   // Sequence in layout
  config: {
    heading?: string;
    subheading?: string;
    desktop?: {
      frames?: string[];           // Preserved 22-frame animation assets
      scrub_speed?: number;
      overlay_intensity?: number;
    };
    mobile?: {
      poster_url?: string;
      auto_play?: boolean;
    };
    styling?: {
      padding_top?: string;
      padding_bottom?: string;
      bg_pattern?: string;
    };
    cta_label?: string;
    cta_url?: string;
    product_ids?: string[];
    category_ids?: string[];
  };
}
```

---

## 3. Registered Section Components
The central section registry supports 24 high-conversion components:
1. `scroll_frame_hero`: 22-frame desktop canvas scrubbing engine with mobile fallback poster.
2. `category_grid`: Visual showcase of cake and bakery categories with count badges.
3. `product_grid`: Curated product showcase with dynamic pricing and ratings.
4. `product_carousel`: Smooth horizontal scroll rails for bestsellers and trending cakes.
5. `occasion_tiles`: High-intent occasion-based gifting paths (Birthday, Anniversary, etc.).
6. `custom_cake_teaser`: Visual CTA to the 3D/Interactive Cake Customisation Studio.
7. `trust_indicators`: 4-pillar trust badging (Same-Day Delivery, FSSAI Certified, Artisanal, Freshly Baked).
8. `social_proof_reviews`: Real customer testimonials with verified purchase tags.
9. `bakers_story`: Editorial craftsmanship storytelling block with vintage borders.
10. `faq_accordion`: Expandable FAQ accordion addressing dietary, storage, and delivery questions.
11. `newsletter_signup`: VIP cake club subscription for exclusive offers.
12. `promotional_banner`: Seasonal campaign banners with countdown and CTAs.

---

## 4. Editorial vs Authoritative Business Data Boundaries

| Domain | Controlled by CMS (Draft / Published) | Controlled by PostgreSQL & Services |
| :--- | :--- | :--- |
| **Product Pricing** | Layout position, highlight badge | Base price, variant pricing, tier discounts |
| **Inventory & Stock**| Section inclusion | Branch stock level, reservation locks |
| **Taxes & GST** | Informational text labels | CGST (9%), SGST (9%), IGST (18%), HSN codes |
| **Delivery Slots** | Promotional banner mentions | Pincode radius, slot availability, cut-off times |
| **Coupons & Offers** | Promotional banner styling | Database coupon validation, minimum spend rules |
| **Order Totals** | Never stored in CMS | Authoritative transactional order totals |

---

## 5. Revision & Rollback Durability

Each time a page is published:
1. A deep clone of `published_config` is written to `version_history`.
2. The snapshot includes `version`, `version_id`, `published_at`, `title`, and `sections_count`.
3. In-flight animation frame assets in `scroll_frame_hero` are safeguarded and never dropped during rollbacks.
4. Rollback operations are persisted directly to PostgreSQL via `apiClient.rollbackCmsPage` and verified transactionally.
