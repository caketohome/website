# CAKETOHOME — FEATURE INTEGRATION MATRIX
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

| Feature ID | Operation | Trigger Surface | Affected Surfaces | Data Synchronized | Latency | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INT-01** | Add Bank Account | Accounting App | Bank Register, COA, GL, TB, Reports | Mapped GL 1112-XX, Opening Bal JV | < 300ms | **PASS (TEST-A1..A7)** |
| **INT-02** | Cashfree Webhook | Payment Gateway | Orders, Kitchen, Inventory, Accounting | Paid status, KOT ticket, stock deduction, clearing JV | < 450ms | **PASS (TEST-C1..C7)** |
| **INT-03** | Order Delivery | Delivery App / Admin | Orders, Customer Portal, Accounting, GST | Statutory CH Invoice, Revenue Recognition JV | < 400ms | **PASS (TEST-C8..C10)** |
| **INT-04** | Cashfree Settlement | Cashfree Payout | Settlements, Bank Register, Admin Gateway | In-transit voucher (1113->1115+5290), expected balance | < 350ms | **PASS (TEST-B1..B4)** |
| **INT-05** | Statement UTR Match | Accounting BRS | Settlements, Bank Register, BRS, GL | Realization voucher (1115->1112), current balance update | < 380ms | **PASS (TEST-B5..B7)** |
| **INT-06** | Bank Transfer | Accounting App | Source Bank, Dest Bank, GL, Audit | Contra JV (Dr Dest / Cr Source), transaction registers | < 320ms | **PASS (TEST-E1..E2)** |
| **INT-07** | Inventory Update | Admin Inventory | Branch POS, Storefront, Movement Log | Branch quantity, stock movement audit line | < 250ms | **PASS (TEST-D1)** |
| **INT-08** | Multi-Session Sync | Any Surface | All Connected SSE Clients | Real-time event streaming with RBAC isolation | < 100ms | **PASS (TEST-F1..F4)** |
| **INT-09** | Dead-Letter Replay | Operator Action | System Monitoring, Outbox Consumer | Event replay, alert marked RESOLVED | < 280ms | **PASS (TEST-F5..F6)** |
| **INT-10** | Razorpay Decom | Legacy API | Storefront Checkout | 410 GONE returned; Cashfree exclusive | < 50ms | **PASS (TEST-C1)** |
