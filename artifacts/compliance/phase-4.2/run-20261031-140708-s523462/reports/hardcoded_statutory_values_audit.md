# Hardcoded Statutory Values Audit — Phase 4.2 Independent Forensic Audit

## 1. Executive Summary

A comprehensive, repository-wide automated regex scan was executed across all TypeScript (`.ts`, `.tsx`), JavaScript (`.js`, `.mjs`), and SQL (`.sql`) source files in `frontend/src/` to identify hardcoded statutory identifiers, company legal names, invoice prefix defaults, fiscal-year literals, and synthetic approval values.

Evidence artifact: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/hardcoded_values_scan.json`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/hardcoded_values_scan.json)

---

## 2. Match Classification & Risk Assessment

| Identifier / Pattern | Occurrences | Context & Files | Risk Level | Assessment & Resolution |
| :--- | :---: | :--- | :---: | :--- |
| **`29AABCC1234F1Z5`** (Active Corporate GSTIN) | 8 | UI Placeholders (`invoice-billing-tab.tsx`), migration backfills (`c7_12`), and `api-engine.ts` memory mocks | LOW / INFORMATIONAL | Verified absent from active runtime order invoicing. Runtime resolves GSTIN strictly via `branch.gst_registration_id -> gst_registration.gstin`. |
| **`29AAACC1234F1Z5`** (Historical Sister Entity GSTIN) | 2 | Migration `c7_12` isolation query | ZERO / HISTORICAL | Legitimate immutable historical reference used exclusively to isolate legacy `CTH` sequence as `DEPRECATED_HISTORICAL`. |
| **`CakeToHome India Private Limited`** | 13 | UI form defaults (`business-profile-tab.tsx`, `gst-registrations-tab.tsx`), Excel export header | LOW / NON-STATUTORY | Present in UI display fallbacks. Runtime invoicing path retrieves legal name relationally via `branch.company_id -> company.legal_name`. |
| **`"CTH"` Literal in `allocate_order_number`** | 1 | `order.service.ts` (Line 423) | ZERO / COMPLIANT | Governs customer-facing order display IDs (`order_display_id_seq`), NOT tax invoices. Mandatory separation preserved. |
| **`"CTH"` Literal in `BillsReceivableService`** | 1 | `bills-receivable.service.ts` (Line 1061) | **HIGH / VERIFIED DEFECT** | Hardcoded parameter to `allocate_invoice_number`. **Remediated** in Phase 4.2 to dynamically query `public.invoice_sequence` and fail closed under CGST Rule 46. |
| **`"CTH"` Literal in Settings Routes** | 2 | `route.ts` (Lines 10355, 11875), `company.repository.ts` | LOW / INERT | Settings fallback when client sends empty payload. Does not bypass database-driven series check during invoice allocation. |
| **`ca_audit_signed`** | 1 | Migration `c7_12` (Line 42) | **HIGH / PROVENANCE RISK** | Synthetic approver string in SQL migration. Restrained to test sequences (`SAFE-TEST`, etc.). Must not be applied in production. |
| **`system_audit`** | 1 | Migration `c7_12` (Line 35) | LOW / AUDIT LOG | Internal label applied when deprecating historical legacy `CTH` sequence. |
| **`fy = 2026` (Static Fiscal Year)** | 0 | `delivery-invoicing.service.ts` | ZERO / ELIMINATED | Verified 0 occurrences. Replaced by dynamic Indian fiscal year engine `resolveIndianFiscalYear`. |

---

## 3. Detailed Forensic Code Path Traces

### 3.1 Retail Delivery Invoicing Path (`DeliveryInvoicingService`)
- Inspected lines 375–415 in [`delivery-invoicing.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts#L375-L415).
- **Finding**: **VERIFIED PASS**. There is NO fallback to `"CTH"` or `"29AABCC1234F1Z5"`.
- If no approved active sequence row is found for the seller GSTIN and dynamic fiscal year, the service strictly returns:
  ```json
  {
    "success": false,
    "error": "Cannot generate statutory invoice: No authorized statutory invoice series exists for seller GSTIN '...' in FY ... Statutory invoice allocation blocked fail-closed under CGST Rule 46 pending CA / Tax Counsel authorized series designation.",
    "code": "UNAUTHORIZED_INVOICE_SERIES"
  }
  ```

### 3.2 Corporate Billing Path (`BillsReceivableService`)
- Inspected lines 1046–1075 in [`bills-receivable.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-receivable.service.ts#L1046-L1075).
- **Finding**: **VERIFIED DEFECT (REMEDIATED)**. Line 1061 previously passed literal `"CTH"`.
- **Remediation Applied**: Refactored to query `public.invoice_sequence` dynamically for an approved active series for `branchGstin` and `fiscalYear`. If none exists, throws `BillsReceivableError("UNAUTHORIZED_INVOICE_SERIES", ...)`, matching the fail-closed statutory requirement.

### 3.3 Customer Order Display Numbering (`OrderService`)
- Inspected line 423 in [`order.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/order.service.ts#L423):
  ```ts
  const seqRes = await client.query(`SELECT * FROM public.allocate_order_number('CTH')`);
  ```
- **Finding**: **VERIFIED PASS**. This calls `public.allocate_order_number`, which increments `public.order_display_id_seq` to assign customer order numbers (e.g., `CTH-98587`). It has zero relation to statutory GST tax invoices. Preserving this is explicitly required by Section 15 of the mandate.

