# CAKETOHOME — CMS EXISTING STATE AUDIT
**Phase:** 6.2 — Content Management System & No-Code Website Builder  
**Author:** Principal Software Architect & Full-Stack Engineering Team  
**Date:** 2026-11-10  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Prior to the Phase 6.2 engineering remediation, CakeToHome possessed extensive frontend page configuration components and section renderers, but lacked the database persistence layer, revision snapshots, and database-backed content records required for independent content publishing. This gap resulted in HTTP 404 responses for customer-facing dynamic CMS routes (such as `/about-us`, `/terms-and-conditions`, and `/faq`).

This audit documents the pre-existing system state, code assets, database limitations, and the exact architectural boundaries identified prior to migration.

---

## 2. Inventory of Existing CMS Code Assets

An exhaustive codebase inspection identified four primary assets comprising over 7,800 lines of production code:

| Component / File | File Path | Line Count | Existing Capabilities | Missing / Broken Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **`PageRenderer`** | `frontend/src/components/store/cms/page-renderer.tsx` | 4,052 lines | Renders 45+ UI section types (Hero, Features, Product Grid, Testimonials, FAQ, Contact Form, Rich Text, USP Banners). | Relied on in-memory or fallback props; threw 404 when database returned 0 rows. |
| **`PageConfigurator`** | `frontend/src/components/dashboard/admin/page-configurator.tsx` | 1,900 lines | Visual block builder, section drag-and-drop reordering, device viewport toggles (Desktop/Tablet/Mobile), property inspector. | Save mutations failed or were non-persistent due to missing DDL schema columns in PostgreSQL. |
| **`SECTION_REGISTRY`** | `frontend/src/components/store/cms/sections/section-registry.tsx` | 1,288 lines | Comprehensive block dictionary with schema defaults, prop definitions, and type enums for 45+ section variants. | Lacked persistence link to database-backed `cms_block` records. |
| **`CmsRepository`** | `frontend/src/lib/repositories/cms.repository.ts` | 618 lines | Repository interfaces for pages, blocks, navigation, redirects, and versions. | Methods queried non-existent columns (`type`, `status`, `blocks`, `published_at`, `meta_title`) causing SQL runtime errors. |
| **`ApiEngine`** | `frontend/src/lib/api-engine.ts` | 3,450 lines | Included `DEFAULT_CMS_PAGES` dictionary with 20 canonical page definitions. | Pages existed only in TypeScript memory and were not synchronized with PostgreSQL. |

---

## 3. PostgreSQL Database Audit (Pre-Remediation)

Inspection of both target databases (`cth_test` and `cth_rehearsal_phase5`) on PostgreSQL port 5433 revealed the following schema deficiency:

```sql
-- Existing pre-remediation schema for cms_page:
CREATE TABLE public.cms_page (
    id character varying NOT NULL,
    slug character varying NOT NULL,
    title character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);
```

### Critical Database Deficiencies Identified:
1. **Missing Status & Publication Columns:** No `status` (`draft`, `review`, `scheduled`, `published`, `archived`), `published_at`, `published_config`, or `scheduled_at` fields.
2. **Missing Content & Layout Columns:** No `blocks` (JSONB) or `sections` storage column.
3. **Missing SEO & OpenGraph Columns:** No `meta_title`, `meta_description`, `canonical_url`, or `og_image` fields.
4. **Missing Relational Tables:** The following required relational tables were completely absent:
   - `cms_revision` (version snapshots and audit rollback history)
   - `cms_block` (reusable global blocks)
   - `cms_navigation` (header/footer menus)
   - `cms_redirect` (SEO 301 redirects)
   - `cms_theme_setting` (approved brand design tokens)
   - `cms_page_template` (reusable page blueprints)
   - `media` (media library and asset metadata)
5. **Zero Row Count:** `SELECT COUNT(*) FROM cms_page` returned `0`.

---

## 4. Root Cause Analysis of CMS 404 Defect

When a customer or crawler requested `/about-us`:
1. Next.js App Router dynamic route `src/app/(store)/[slug]/page.tsx` invoked `CmsRepository.findPageBySlug('about-us')`.
2. `CmsRepository` executed `SELECT * FROM cms_page WHERE slug = 'about-us'`.
3. PostgreSQL returned empty rows (`res.rows.length === 0`).
4. The route triggered `notFound()`, returning HTTP 404 to the browser.
5. In addition, when `CmsRepository.findAllPages()` attempted to query columns like `status` or `type`, PostgreSQL threw `42703 (undefined_column)`.

---

## 5. Architectural Guardrails Preserved

1. **Financial Baseline Preservation:** All financial tables in `cth_test` (`order`: 127, `invoice`: 71, `payment_transaction`: 40) remained untouched.
2. **Payment Gateway Isolation:** Cashfree Payments remains the sole active gateway; Razorpay remains decommissioned at HTTP 404.
3. **Route Whitelist Protection:** Core commerce funnels (`/cart`, `/checkout`, `/your-order`, `/admin`, `/dashboard`) are protected from dynamic CMS slug hijacking.
