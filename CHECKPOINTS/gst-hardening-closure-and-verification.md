# Checkpoint: CakeToHome ERP — GST Hardening Closure & Verification Report

**Project:** CakeToHome ERP  
**Workstream:** Statutory Compliance & GST Reporting Hardening  
**Date:** 2026-10-15  
**Status:** 🔒 **GST HARDENING WORKSTREAM CLOSED (MANAGEMENT REPORT ONLY)**  
**Statutory Filing Readiness:** ⚠️ **NOT CERTIFIED FOR STATUTORY FILING**  
**Authoritative Source of Truth:** Live PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Artifact Reference:** [`gst_reporting_implementation.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/cb7b6e1f-0b22-4701-9b04-b4142f6ebf68/gst_reporting_implementation.md)

---

## 1. Executive Summary & Closure Decision

The GST Hardening Workstream has successfully completed forensic auditing, bug fixes, schema realignment, formula injection security hardening, and positive calculation proofs across all GST components in the CakeToHome ERP.

### Statutory Filing Distinction:
- **Management Reports Only**: All GSTR-1, GSTR-3B, HSN Summary, and Sales Register exports are strictly classified as **Internal Management Audit Reports**.
- **Not Portal-Upload Files**: Outputs do **not** generate official GSTN-compliant JSON or official offline utility CSV files for direct statutory filing.
- **Master Data Requirement**: 14 of 22 products currently lack statutory HSN classification in the product master. Until the business assigns official 8-digit HSN codes in the Product Master, these products are flagged with `HIGH` severity warnings as `UNCLASSIFIED` (`"Unclassified (Missing HSN Code)"`).

---

## 2. Verified Workstream Results

| Functional Area | Hardening Action | Final Verified State |
|---|---|---|
| **Credit Notes** | Sourced strictly from persisted refund tables (`order_lifecycle_refund`, `refund`) | Excluded non-statutory status changes (2/2 test cancellations excluded). Deduplicated across tables. Derived tax proportionally (50/50 intra-state CGST + SGST). |
| **HSN Classification** | Eradicated default `"19059090"` fallbacks across all 5 repository and data providers | Unclassified items strictly marked `UNCLASSIFIED` (`"Unclassified (Missing HSN Code)"`), triggering `HIGH` severity statutory data quality alerts. Never persisted to PostgreSQL. |
| **Input Tax Credit** | Aligned SQL query in `GstReportingService` with PostgreSQL `expense` schema | Fixed column mismatches (`category_id`, `reference_no`, `supplier_id` join). Demonstrated positive ₹500.00 ITC calculation in an atomic transaction with zero database mutations. |
| **CSV Security** | Wired `sanitizeCsvCell` across all 4 CSV export cases | Neutralized formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with `'` prefix and escaped double quotes per RFC 4180. |
| **TypeScript** | System-wide compilation check | `npx tsc --noEmit` exited with code 0 (zero type errors). |

---

## 3. Flagged Accounting-Data Invariant: Invoices 000034 & 000035

### Discrepancy Record:
- **Invoice `CTH/26-27/000034`**: Subtotal ₹1,142.86 + Tax ₹57.14 + Delivery ₹50.00 = **₹1,250.00** vs Header Grand Total = **₹1,260.00** (₹10.00 difference)
- **Invoice `CTH/26-27/000035`**: Subtotal ₹1,142.86 + Tax ₹57.14 + Delivery ₹50.00 = **₹1,250.00** vs Header Grand Total = **₹1,260.00** (₹10.00 difference)

### Governance & Non-Mutation Policy:
1. **Root Cause**: Traced to historical test fixtures (`test_step4_2_sales_voucher.js`) where the order metadata had `total_amount = 1260` (originally testing 1200 base + 60 IGST). When `DeliveryInvoicingService` decomposed the cake item, it calculated ₹1,142.86 taxable + ₹57.14 intra-state GST (5%) + ₹50 delivery fee = ₹1,250, while taking `grand_total` directly from `order.total_amount` (1260).
2. **Strict Financial Immutability**: **DO NOT SILENTLY EDIT POSTED FINANCIAL HISTORY.** These records are permanently flagged in the accounting ledger as tainted test artifacts. They must never be mistaken for clean reference invoices.
3. **Controlled Resolution**: Any eventual resolution must occur via formal audit adjustment entries or credit note/debit note workflow, preserving full historical auditability.
4. **GST Isolation**: `GstReportingService.getSalesRegister` independently computes from line items (`round2(taxableValue + totalTax)` = ₹1,200.00 per cake), remaining mathematically accurate and isolated from the header disparity. Check 4 in `runDataQualityChecks` actively audits and surfaces this divergence.

---

## 4. Source of Truth & Artifact Preservation

- All GST queries execute directly against live PostgreSQL (`public."order"`, `public.invoice`, `public.expense`, `public.supplier`, `public.gst_registration`).
- In-memory mock/fallback behavior is disabled.
- Verification test scripts preserved in `frontend/scratch/`:
  - `gst_e2e_verification.js`
  - `test_positive_itc_demonstration.js`
  - `test_csv_sanitization.js`
  - `gst_invoice_deep_dive.js`
- Full audit evidence and diff logs preserved in [`gst_reporting_implementation.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/cb7b6e1f-0b22-4701-9b04-b4142f6ebf68/gst_reporting_implementation.md).
