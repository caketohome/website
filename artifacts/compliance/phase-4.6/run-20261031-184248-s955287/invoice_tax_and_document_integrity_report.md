# Invoice Tax and Document Integrity Report
**Target:** `cth_rehearsal_phase4_6`  

---

## 1. Tax Calculation Verification
- **Intrastate Supply (Karnataka to Karnataka):** 18% GST partitioned as 9% CGST + 9% SGST.
- **Interstate Supply (Karnataka to other states):** 18% IGST.
- **Delivery Charge GST:** Taxed at the principal supply rate (composite supply under CGST Section 8).
- **Rounding:** Rounded to nearest integer paise (Rule 46 compliance).

## 2. Document Rendering Consistency
Verified that the identical invoice number string stored in `public.invoice.invoice_number` is passed unchanged to:
- Next.js API response JSON.
- Order Details drawer & print modal.
- React PDF generation template.
