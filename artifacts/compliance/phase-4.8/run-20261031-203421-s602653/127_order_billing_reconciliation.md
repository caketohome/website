# 127-Order Billing Reconciliation
**Total Orders in Database:** 127

---

## 1. Macro Reconciliation
- **Invoiced Orders:** **58** (linked to rows in `public.invoice`)
- **Unbilled Orders:** **69** (no associated invoice row)
- **Sum Check:** $58 + 69 = 127$ (100% accounted for)

## 2. Breakdown of 69 Unbilled Orders

| Order Status | Count | Invoicing Obligation | Explanation |
|---|---|---|---|
| **Delivered** | **21** | Subject to Statutory Review | Orders marked delivered without invoices (audited in detail below). |
| **Pending / Confirmed** | **31** | Not Yet Invoiced | In-flight orders awaiting fulfillment. |
| **Cancelled / Returned** | **17** | No Invoicing Obligation | Terminated orders; no supply occurred. |
| **Total** | **69** | — | Fully reconciled. |
