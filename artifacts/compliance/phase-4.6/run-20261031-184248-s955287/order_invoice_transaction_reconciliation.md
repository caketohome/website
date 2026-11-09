# Order-to-Invoice Transaction Reconciliation
**Database Environment:** Protected Baseline `cth_test` (port 5433)  

---

## 1. Forensic Order Inventory (127 Total Orders)

| Order Status | Total Orders | Invoiced Orders | Unbilled Orders | Forensic Explanation |
| :--- | :---: | :---: | :---: | :--- |
| **completed** | 57 | 55 | 2 | 55 invoiced upon delivery; 2 completed prior to billing hook setup |
| **confirmed** | 26 | 0 | 26 | Order ≠ Bill invariant: order placed, awaiting fulfillment |
| **delivered** | 24 | 3 | 21 | 3 billed upon delivery; 21 historical test deliveries from Phase 3 |
| **pending** | 19 | 0 | 19 | In kitchen/store order processing queue |
| **preparing** | 1 | 0 | 1 | In production prep queue |
| **TOTAL** | **127** | **58** | **69** | **100% Mathematically Reconciled (58 + 69 = 127)** |

## 2. Invoicing Integrity Invariants
- Zero orders have multiple active invoices.
- Zero invoices have NULL `order_id`.
