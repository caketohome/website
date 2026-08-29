# CakeToHome: Authoritative Data Source Map

**Database**: PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Status**: Authoritative & Single Source of Truth  
**Last Updated**: August 2026

---

## 1. Domain Entities & Database Mapping

This document provides a single reference map for all domain entities in CakeToHome, detailing their PostgreSQL tables, persistence functions, and hydration workflows.

| Entity | Primary Database Table | Hydration Query | Persistence Function | In-Memory Sync |
| :--- | :--- | :--- | :--- | :--- |
| **Product & PIM** | `public.product` | `SELECT * FROM "product" WHERE deleted_at IS NULL` | `persistProductToDb(prod)` | `memoryStore.products` |
| **Weight Prices** | `public.product` (in metadata) | Hydrated from product metadata / default matrix | `saveProductWeightPrices(pId, wps)` | `memoryStore.product_weight_prices` |
| **Flavors / Shapes**| `public.product` (in metadata) | Hydrated from product metadata `flavors`/`shapes` | `saveProductFlavorMappings`<br>`saveProductShapeMappings` | `memoryStore.products[i].flavors`<br>`memoryStore.products[i].shapes` |
| **Branch** | `public.branch` | `SELECT * FROM "branch" WHERE deleted_at IS NULL` | `persistBranchToDb(branch)` | `memoryStore.branches` |
| **Delivery Zone** | `public.delivery_zone`| `SELECT * FROM "delivery_zone" WHERE deleted_at IS NULL` | `persistBranchZoneToDb(branchId, zone)` | `memoryStore.branches[i].delivery_zones` |
| **City** | `public.city` | `SELECT * FROM "city" WHERE deleted_at IS NULL` | `persistCityToDb(city)` | `memoryStore.cities` |
| **Customer** | `public.customer` | `SELECT * FROM "customer" WHERE deleted_at IS NULL` | `persistCustomerToDb(customer)` | `memoryStore.customers` |
| **Customer Address**| `public.customer_address`| `SELECT * FROM "customer_address" WHERE deleted_at IS NULL` | `persistCustomerAddressToDb(addr)` | `memoryStore.customers[i].addresses` |
| **Delivery Partner**| `public.delivery_partner`| `SELECT * FROM "delivery_partner" WHERE deleted_at IS NULL` | `persistDeliveryPartnerToDb(partner)` | `memoryStore.delivery_partners` |
| **Order** | `public.order` | `SELECT * FROM "order" WHERE deleted_at IS NULL LIMIT 500` | `persistOrderToDb(order)` | `memoryStore.orders` |
| **CMS Page** | `public.cms_page` | `SELECT * FROM "cms_page" ORDER BY created_at ASC` | `persistCmsPageToDb(page)` | `memoryStore.cms_pages` |
| **CMS Sections** | `public.cms_homepage_section`| `SELECT * FROM "cms_homepage_section" ORDER BY sort_order ASC` | `persistCmsPageToDb` / Section Upsert | `memoryStore.cms_sections` |
| **Offer / Coupon** | `public.offer` | `SELECT * FROM "offer" WHERE deleted_at IS NULL` | `persistOfferToDb(offer)` | `memoryStore.offers` |
| **System Settings**| `public.setting` | `SELECT * FROM "setting" WHERE deleted_at IS NULL` | `persistSettingToDb(group, key, val)` | `memoryStore.settings` |
| **Popup Campaigns**| `public.popup_campaigns`| `SELECT * FROM "popup_campaigns" WHERE deleted_at IS NULL` | `persistPopupCampaignToDb(camp)` | `memoryStore.popup_campaigns` |

---

## 2. PIM Option Authority Schema

All PIM options are scoped strictly to individual products inside `public.product.metadata`:

```json
{
  "price": 749,
  "selling_price": 749,
  "mrp": 899,
  "pim_config": {
    "show_shape": true,
    "show_flavour": true,
    "show_eggless": true,
    "max_delivery_distance_km": 25
  },
  "flavors": [
    { "flavor_id": "flv_vanilla", "name": "Classic Vanilla", "price_modifier": 0, "is_enabled": true },
    { "flavor_id": "flv_dutch_choc", "name": "Dutch Chocolate", "price_modifier": 50, "is_enabled": true }
  ],
  "shapes": [
    { "shape_id": "shp_round", "name": "Round", "price_modifier": 0, "is_enabled": true },
    { "shape_id": "shp_heart", "name": "Heart Shape", "price_modifier": 75, "is_enabled": true }
  ],
  "variants_json": {
    "weights": ["0.5 kg", "1 kg", "2 kg"]
  }
}
```

### Option Authority Rules:
1. **0 Mapped Options $\rightarrow$ 0 Customer Options**: If a product has no configured flavors in PIM, the customer is not prompted for flavor selection.
2. **Explicit Whitelist**: Checkout validation validates that the chosen flavor and shape exist in the active `flavors` and `shapes` arrays of the product.
3. **Price Authority**: Any flavor/shape/weight surcharge is added server-side to the base tier price. Client-sent unit prices are discarded.

---

## 3. CMS Page Schema & Blocks

CMS pages are stored in `public.cms_page`:

```sql
CREATE TABLE public.cms_page (
    id text PRIMARY KEY,
    slug text NOT NULL,
    title text NOT NULL,
    type text NOT NULL DEFAULT 'landing',
    status text NOT NULL DEFAULT 'draft',
    blocks text, -- JSON string of { sections, draft_config, published_config, version_history }
    meta_title text,
    meta_description text,
    canonical_url text,
    og_image text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);
```

### CMS Lifecycle:
1. **Draft Creation**: `createCmsPage` $\rightarrow$ `status: 'draft'`, persisted to PostgreSQL with initial sections.
2. **Revisions & Section Reordering**: `updateCmsPage` / `reorderCmsPageSections` $\rightarrow$ updates `blocks.sections`, versions logged to `blocks.version_history`.
3. **Publishing**: `publishCmsPage` $\rightarrow$ snapshots current draft into `blocks.published_config`, sets `status: 'published'`, updates `published_at`.
4. **Unpublishing**: `unpublishCmsPage` $\rightarrow$ sets `status: 'draft'`, sets `blocks.published_config: null`.
5. **Archiving / Deleting**: `deleteCmsPage` $\rightarrow$ sets `deleted_at: now()`, `status: 'archived'`.

---

## 4. Location & Order Persistence Schema

When an order is created, location coordinates and serving branch are immutably captured into `public.order`:

```sql
INSERT INTO "order" (
    "id", "display_id", "email", "total", "status", "currency_code", "tax_rate",
    "delivery_latitude", "delivery_longitude", "branch_id", "metadata", "created_at", "updated_at"
) VALUES (
    $1, $2, $3, $4, $5, 'INR', $6,
    $7, $8, $9, $10, NOW(), NOW()
);
```

- `delivery_latitude` (numeric 10,6): 6-decimal high-precision latitude.
- `delivery_longitude` (numeric 10,6): 6-decimal high-precision longitude.
- `branch_id`: Resolved nearest servicing hub or customer-selected pickup store.
