# CakeToHome — Master Database Data Flow Audit

## Executive Summary

This document details the complete end-to-end data flow mapping across all business entities within the CakeToHome platform, documenting their database tables, read/write services, frontend consumers, caching policies, and persistence verification status.

---

## 1. Master Entity Data Flow Audit Table

| Business Entity | PostgreSQL Table | Read API / Service | Write API / Service | Frontend Consumer | Caching & Invalidation | Verification Status |
|---|---|---|---|---|---|---|
| **Products & PIM** | `public.product` | `GET /api/v1/products/:id` $\rightarrow$ `ApiEngine.getProductById` | `PUT /api/v1/admin/catalog/products/:id` $\rightarrow$ `persistProductToDb` | PIM Editor, Product Detail Page, Storefront Catalog | Next.js tag cache `revalidateTag('products')` | **VERIFIED (PostgreSQL)** |
| **Product Variants & Weight Prices** | `public.product_variant` | `GET /api/v1/admin/catalog/products/:id/weight-prices` | `PUT /api/v1/admin/catalog/products/:id/weight-prices` $\rightarrow$ `persistProductToDb` | PIM Weight Matrix Tab, Product Weight Selector | Revalidated on product save | **VERIFIED (PostgreSQL)** |
| **Master Variant Options (Flavours & Shapes)** | `public.variant_option` | `GET /api/v1/admin/catalog/flavors`, `/shapes` $\rightarrow$ `ApiEngine.listVariantOptions` | `POST/PUT/DELETE /admin/catalog/flavors`, `/shapes` $\rightarrow$ `persistVariantOptionToDb`, `deleteVariantOptionFromDb` | PIM Master Option Selector, Option Quick-Create | Hydrated from DB; soft-deleted in table | **VERIFIED (PostgreSQL)** |
| **Product Option Whitelists** | `public.product.metadata` | `GET /api/v1/products/:id/options` $\rightarrow$ `ApiEngine.getStorefrontProductOptions` | `POST /admin/catalog/products/:id/flavor-mappings`, `/shape-mappings` $\rightarrow$ `persistProductToDb` | Product Detail Options, Checkout Option Validator | Whitelist evaluated dynamically; zero fallback | **VERIFIED (PostgreSQL)** |
| **Promotional Offers & Coupons** | `public.offer` | `GET /api/v1/admin/marketing/offers` $\rightarrow$ `ApiEngine.getAdminOffers` | `POST/PUT/DELETE /admin/marketing/offers` $\rightarrow$ `persistOfferToDb`, `deleteOfferFromDb` | Marketing Admin Console, Checkout Coupon Box | Read from hydrated DB store; soft-deleted | **VERIFIED (PostgreSQL)** |
| **Engagement Popup Campaigns** | `public.popup_campaigns` | `GET /api/v1/marketing/popups/active` $\rightarrow$ `ApiEngine.getPopupCampaigns` | `POST/PUT/DELETE /admin/marketing/popup-campaigns` $\rightarrow$ `persistPopupCampaignToDb`, `deletePopupCampaignFromDb` | Storefront Engagement Provider, Popup Modal | Versioned blocks in DB; archived on delete | **VERIFIED (PostgreSQL)** |
| **Customer Delivery Addresses** | `public.customer_address` | `GET /api/v1/customer/addresses` $\rightarrow$ `ApiEngine.getCustomerAddresses` | `POST/PUT/DELETE /api/v1/customer/addresses` $\rightarrow$ `persistCustomerAddressToDb`, `deleteCustomerAddressFromDb` | Checkout Address Selector, Account Dashboard | Persisted with 6-decimal GPS coordinates | **VERIFIED (PostgreSQL)** |
| **Delivery Fleet Partners** | `public.delivery_partner` | `GET /api/v1/admin/delivery-partners` $\rightarrow$ `ApiEngine.getDeliveryPartners` | `POST/PUT /admin/delivery-partners` $\rightarrow$ `persistDeliveryPartnerToDb` | Delivery Dispatch Console, Rider Mobile App | Real-time availability toggled in DB | **VERIFIED (PostgreSQL)** |
| **Platform & Fulfillment Settings** | `public.setting` | `GET /api/v1/admin/fulfillment/config` $\rightarrow$ `ApiEngine.getBusinessProfile`, `getInvoiceSettings` | `POST /admin/fulfillment/config`, `updateAdminSettings` $\rightarrow$ `persistSettingToDb` | Admin Settings, Checkout Fulfillment Rules | Domain grouped key-values in DB | **VERIFIED (PostgreSQL)** |
| **Orders & Fulfillment Tracking** | `public.order` | `GET /api/v1/orders/:id` $\rightarrow$ `ApiEngine.getOrder` | `POST /api/v1/orders` $\rightarrow$ `persistOrderToDb` | Customer Order Tracking, Kitchen KOT Hub | Transactional write with immutable pricing snapshot | **VERIFIED (PostgreSQL)** |
| **Branches & Delivery Hubs** | `public.branch`, `delivery_zone` | `GET /api/v1/branches` $\rightarrow$ `ApiEngine.getBranches` | `POST/PUT /admin/branches` $\rightarrow$ `persistBranchToDb` | Storefront Branch Selector, Kitchen Dispatch | Multi-branch routing matrix in DB | **VERIFIED (PostgreSQL)** |
| **CMS Pages & Homepage Sections** | `public.cms_page`, `cms_homepage_section` | `GET /api/v1/cms/pages/homepage` $\rightarrow$ `ApiEngine.getCmsPage` | `POST/PUT/DELETE /admin/cms/pages` $\rightarrow$ `persistCmsPageToDb`, `deleteCmsPageFromDb` | Storefront Homepage, Custom Landing Pages | Revalidated on CMS publish | **VERIFIED (PostgreSQL)** |

---

## 2. Verification Guarantees

1. **Cold-Start Boot Coherence**: On server startup, `hydrateStoreFromDatabase()` pulls the current state from all 12 database tables.
2. **Server Restart Persistence**: Data created in PIM, Admin, or Storefront remains present across server reboots.
3. **Browser Cache Independence**: Clearing `localStorage`, `sessionStorage`, or browser caches has zero impact on application data persistence.
4. **Anti-Spoofing Calculations**: Checkout prices, taxes, delivery fees, and option surcharges are calculated strictly server-side from PostgreSQL records.
