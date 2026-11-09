# Checkpoint: CakeToHome ERP — Product Master HSN Classification & PostgreSQL Remediation

**Project:** CakeToHome ERP  
**Workstream:** Product Master Catalog & Statutory Tax Classification Remediation  
**Date:** 2026-10-15  
**Status:** 🔒 **PRODUCT MASTER HSN REMEDIATION COMPLETE & VERIFIED**  
**Authoritative Source of Truth:** Live PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Prior Checkpoint:** [`production-readiness-closure-complete.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/production-readiness-closure-complete.md)  
**GST Workstream Reference:** [`gst-hardening-closure-and-verification.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/gst-hardening-closure-and-verification.md) / [`gst_reporting_implementation.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/cb7b6e1f-0b22-4701-9b04-b4142f6ebf68/gst_reporting_implementation.md)  
**Audit Trail Artifact:** [`hsn_remediation_audit_trail.json`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/hsn_remediation_audit_trail.json)

---

## 1. Executive Summary & Objective Completion

This bounded remediation task resolved the statutory HSN classification deficit in the CakeToHome ERP product master across all 14 previously unclassified active catalog products. 

### Key Accomplishments:
1. **Statutory HSN Determination**: Evaluated product characteristics against the First Schedule of the Indian Customs Tariff Act, 1975 and official CBIC GST tariff schedules.
   - 12 bakery products (cakes, cupcakes, pastries, croissants) classified under specific 8-digit tariff line **`1905 90 10`** ("Pastries and cakes").
   - 1 single-flower rose bouquet classified under Chapter 06 tariff line **`0603 11 00`** ("Fresh cut roses and buds suitable for bouquets").
   - 1 mixed carnation/lily bouquet classified under Chapter 06 tariff line **`0603 19 00`** ("Other fresh cut flowers and buds suitable for bouquets").
2. **PostgreSQL Persistence**: Atomically persisted the approved classifications to live PostgreSQL (`public.product.metadata` and `public.product.hs_code`) within a single ACID transaction with strict conditional updates (`(metadata->>'hsn_code' IS NULL OR TRIM(metadata->>'hsn_code') = '')`).
3. **Immutability of Existing Master & Historical Data**:
   - The original 8 classified products (`acc_01`, `acc_02`, and 6 cakes) remained 100% untouched.
   - Historical orders (179 orders) and invoices (5 invoices) were strictly preserved without mutation.
   - Zero generic blanket fallback codes (`19059090`) were used for remediation.
   - The report marker `UNCLASSIFIED` was never persisted to the database.
4. **GST Data Quality Impact**:
   - Total active products in database: 22.
   - Active products with statutory HSN: 22/22 (100%).
   - Missing classifications: 0.
   - The `[HIGH] 14 products lack HSN classification` warning in the GST audit engine eliminated.
   - Non-reopened historical audit findings (e.g., invoices 000034/000035 ₹10 test fixture difference, GST registration configuration) remain preserved per boundary rules.

---

## 2. Product-by-Product Classification Matrix

| Product ID | Exact Product Name | Category | Pre-Remediation HSN | Approved 8-Digit HSN | Statutory HSN Description | Classification Evidence & Statutory Rationale | Confidence & Decision Status |
|---|---|---|---|---|---|---|---|
| `prod_1` | Belgian Chocolate Truffle Cake | Chocolate Cakes | `NULL` | **`19059010`** | Pastries and cakes | Layered chocolate sponge cake with dark chocolate ganache. Indian Customs Tariff 1905 90 10 specifically covers pastries and cakes. | Confirmed |
| `prod_2` | Classic Red Velvet Cream Cheese Cake | Red Velvet Cakes | `NULL` | **`19059010`** | Pastries and cakes | Moist red velvet sponge cake layered with cream cheese frosting. Specific tariff item 1905 90 10. | Confirmed |
| `prod_3` | Fresh Alphonso Mango Mousse Cake | Fruit & Mousse Cakes | `NULL` | **`19059010`** | Pastries and cakes | Layered sponge cake with whipped Alphonso mango mousse. Specific tariff item 1905 90 10. | Confirmed |
| `prod_4` | Black Forest Gateau Special | Black Forest Cakes | `NULL` | **`19059010`** | Pastries and cakes | Traditional German cherry gateau with chocolate shavings. Gateaux are multi-layered cakes under 1905 90 10. | Confirmed |
| `prod_5` | Butterscotch Caramel Crunch Cake | Butterscotch & Caramel Cakes | `NULL` | **`19059010`** | Pastries and cakes | Layered vanilla sponge with butterscotch praline and salted caramel cream. Specific tariff item 1905 90 10. | Confirmed |
| `prod_01KXYMAJKNDZ4T2YVA7K144XP5` | Chocolate Fudge Cupcake | Cupcakes | `NULL` | **`19059010`** | Pastries and cakes | Single-portion sponge cake baked in cup format with fudge ganache. Classified as small cake under 1905 90 10. | Confirmed |
| `prod_01KXYMAJKNV48P1B9CM7C022YM` | Vanilla Bean Cupcake | Cupcakes | `NULL` | **`19059010`** | Pastries and cakes | Single-portion vanilla sponge cake with buttercream frosting. Classified as small cake under 1905 90 10. | Confirmed |
| `prod_01KXYMAJKNH99E1TMWYGQGT61D` | Danish Pastry Assortment | Pastries | `NULL` | **`19059010`** | Pastries and cakes | Assorted sweet laminated puff pastries with fruit fillings and sweet glaze. Directly named under 1905 90 10. | Confirmed |
| `prod_01KXYMAJKNS8AGWCN5S1WEGKSD` | Butter Croissant | Pastries | `NULL` | **`19059010`** | Pastries and cakes | Laminated French butter pastry (viennoiserie). Classified as pastry under 1905 90 10. | Confirmed |
| `prod_dist_pg_persisted_test` | Artisan Dedicated PG Test Cake | Chocolate Cakes | `NULL` | **`19059010`** | Pastries and cakes | Artisanal chocolate layer cake. Specific tariff item 1905 90 10. | Confirmed |
| `prod_dist_test_01` | Artisan Delicate Truffle Cake | Chocolate Cakes | `NULL` | **`19059010`** | Pastries and cakes | Artisanal chocolate truffle cake. Specific tariff item 1905 90 10. | Confirmed |
| `prod_dist_test_02` | Sturdy Dry Fruit Tea Cake | Chocolate Cakes | `NULL` | **`19059010`** | Pastries and cakes | Baked dry fruit tea cake / sponge loaf. Specific tariff item 1905 90 10. | Confirmed |
| `prod_bouquet_rose_01` | Royal Red Velvet Roses Bouquet | Bouquets & Fresh Flowers | `NULL` | **`06031100`** | Fresh cut roses and buds suitable for bouquets | 12 fresh red Dutch roses, hand-tied bunch with luxury wrap. Chapter 06, Heading 0603, Subheading 0603 11 00 specifically covers fresh cut roses. | Confirmed HSN (Tax slab flagged for review) |
| `prod_bouquet_carnation_01` | Pastel Dutch Carnations & Lilies Bouquet | Bouquets & Fresh Flowers | `NULL` | **`06031900`** | Other fresh cut flowers and buds suitable for bouquets | Mixed bouquet of fresh pink Dutch carnations and Asiatic lilies. Under GRI 3(c) for mixed cut flowers, Subheading 0603 19 00 covers other cut flowers for bouquets. | Confirmed HSN (Tax slab flagged for review) |

---

## 3. Preservation of Original 8 Classified Products

The 8 products that already possessed verified HSN codes prior to this workstream were verified as 100% intact and unmutated:

| Product ID | Product Name | Category | Persisted HSN | Persisted GST Rate | Verification Status |
|---|---|---|---|---|---|
| `acc_01` | Gold Acrylic Happy Birthday Topper | Cake Accessories | `95059000` | 18% | ✅ UNTOUCHED |
| `acc_02` | Magic Re-Lighting Birthday Candles (Pack of 10) | Cake Accessories | `95059000` | 18% | ✅ UNTOUCHED |
| `prod_01KXYMAJKNWZCFXJHESPTZE01G` | Classic Chocolate Truffle Cake | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |
| `prod_01KXYMAJKNXGS5WT4R0QNQGV5F` | Red Velvet Dream Cake | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |
| `prod_1788960228243` | RED BEE | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |
| `prod_1788960313218` | CHOCO RED | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |
| `prod_1788960554491` | PISTACHIO GATEAU | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |
| `prod_1788960674375` | CHOCOLATE TRUFFLE | Chocolate Cakes | `19059090` | 5% | ✅ UNTOUCHED |

---

## 4. Professional Accounting & Tax Notes (Flagged for Client Review)

1. **Flower Bouquet GST Rate vs Statutory Exemption**:
   - Both `prod_bouquet_rose_01` (HSN `06031100`) and `prod_bouquet_carnation_01` (HSN `06031900`) currently retain `gst_rate = 5` in catalog metadata.
   - Under CBIC Notification No. 2/2017-Central Tax (Rate), Entry 34, fresh natural cut flowers are generally exempt (0% GST rate).
   - In accordance with Mandatory Rule 5 (*"Do not infer that a product's tax rate is correct merely because its HSN is known, or infer HSN from the current tax rate"*), the tax rate was intentionally left unmodified. The business accountant should determine whether CakeToHome treats bouquets as exempt agricultural supplies (0%) or as composite luxury retail gift supplies (5% or 18% depending on service/goods mix).
2. **Bakery Goods Supply Slab vs Restaurant Service**:
   - In general trade under Schedule III (Notification 1/2017-CT Rate, S.No. 16), pastries and cakes under HSN `1905 90 10` attract 18% GST for standard goods trade, or 5% without ITC when provided as restaurant/catering takeaway. CakeToHome's current catalog metadata configures cakes with `gst_rate = 5`. This rate is preserved as-is.

---

## 5. Verification Commands & Evidence

| Verification Suite | Execution Command | Result / Finding | Status |
|---|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` (in `frontend/`) | Exit code 0 (0 errors) | ✅ PASSED |
| **Controlled DB Remediation** | `node scratch/execute_hsn_remediation.js` | 14 rows updated in atomic transaction; 0 rollbacks; audit trail written to JSON | ✅ PASSED |
| **Independent DB Verification** | `node scratch/verify_phase5_remediation.js` | 99/99 assertions passed (22 active, 22 classified, 0 unclassified, 8 original intact, 0 unclassified markers, idempotency verified) | ✅ PASSED |
| **Repository Reads Verification** | `node scratch/verify_repository_reads.js` | 22/22 products returned with populated statutory HSN in application domain models | ✅ PASSED |
| **GST End-to-End Audit** | `node scratch/gst_e2e_verification.js` | Product HSN audit: 22/22 with HSN, 0 missing. High-severity missing HSN warning eliminated. Prior workstream checkpoints untouched. | ✅ PASSED |
| **CSV Sanitization Test** | `node scratch/test_csv_sanitization.js` | 3/3 sanitization test groups passed | ✅ PASSED |
| **Positive ITC Test** | `node scratch/test_positive_itc_demonstration.js` | ₹500 positive ITC demonstrated in rolled-back transaction | ✅ PASSED |

---

## 6. Historical Records Preserved Intact

- Invoices in PostgreSQL: 5 records (CTH/26-27/000031 through 000035) — 0 modified.
- Orders in PostgreSQL: 179 records — 0 modified.
- Journal entries, vouchers, and trial balance — 0 modified.
