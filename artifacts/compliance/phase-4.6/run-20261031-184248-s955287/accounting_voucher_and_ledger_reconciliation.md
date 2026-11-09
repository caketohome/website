# Accounting Voucher and Ledger Reconciliation
**Table:** `public.accounting_voucher` on `cth_test`  

---

## 1. Complete Voucher Inventory

| Voucher ID | Voucher Number | Type | Status | Amount (INR) | Order ID | Reference Event |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `vch_00MVP5Q6PK8BMEJX` | `VCH-SALES-FY2026-27-20261026-R37KDP` | SALES | DRAFT | 681.46 | Order 98559 | `INVOICE_DRAFT` |
| `vch_00MVP6L5Q95QVECS` | `VCH-SALES-FY2026-27-20261026-LAJZG2` | SALES | DRAFT | 915.10 | Order 98561 | `INVOICE_DRAFT` |
| `vch_00MVTKB82NP6GU28` | `VCH-SALES-FY2026-27-20261029-MCHEOO` | SALES | DRAFT | 765.82 | Order 98586 | `INVOICE_DRAFT` |
| `vch_00MVTQ5KTT8HXVN2` | `VCH-SALES-FY2026-27-20261029-YVXK7Y` | SALES | CANCELLED | 681.46 | Order 98587 | `INVOICE_DRAFT` |

## 2. General Ledger Impact
- **Posted Vouchers:** 0.
- **Unposted Draft Vouchers:** 3.
- **Cancelled Vouchers:** 1 (Voucher 1004).
- Because no voucher was ever posted to the general ledger, **no GL balances were impacted**, and cancelling draft Voucher 1004 required no reversing journal entry.
