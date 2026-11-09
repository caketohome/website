# CAKETOHOME — CROSS-APPLICATION E2E TEST REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  
**Total Tests:** 35 | **Passed:** 35 | **Failed:** 0 | **Pass Rate:** 100.0%  

---

## 1. COMPREHENSIVE TEST RESULTS
| Test ID | Scenario | Result | Latency | Assertion Detail |
| :--- | :--- | :---: | :--- | :--- |
| **TEST-A1** | Create Bank Account via API | **PASS** | 225ms | Bank master row created and linked to child GL 1112-XX |
| **TEST-A2** | Verify Bank in Register | **PASS** | 78ms | Opening balance ₹1,25,000.00 reflects immediately |
| **TEST-A3** | Verify Masked Account Number | **PASS** | 45ms | Account number masked (`•••• 3344`) in API responses |
| **TEST-A4** | Verify Child GL in COA | **PASS** | 62ms | Dedicated child GL appears under 1110 with ASSET/BANK |
| **TEST-A5** | Verify GL Ledger Balance | **PASS** | 89ms | General Ledger reflects ₹1,25,000 opening debit |
| **TEST-A6** | Verify Trial Balance Balance | **PASS** | 112ms | Total Debits == Total Credits; Difference = ₹0.00 |
| **TEST-A7** | Verify Balance Sheet & Cash Flow | **PASS** | 134ms | Closing cash matches Balance Sheet; 100% reconciled |
| **TEST-B1** | Cashfree Settlement Ingestion | **PASS** | 185ms | Ingested as `SETTLEMENT_IN_TRANSIT`; voucher posted |
| **TEST-B2** | Verify Expected vs Current Bal | **PASS** | 42ms | Expected bal +₹9,764; realized bal NOT fabricated |
| **TEST-B3** | Cashfree Settlements API List | **PASS** | 68ms | New settlement batch listed in API response |
| **TEST-B4** | Admin Gateway Batch Sync | **PASS** | 74ms | Admin Gateway Settlement Panel 100% synchronized |
| **TEST-B5** | Bank Statement UTR Match | **PASS** | 210ms | Realized from 1115 to 1112 Bank GL; marked RECONCILED |
| **TEST-B6** | Verify Bank Current Balance | **PASS** | 48ms | Bank current_balance +₹9,764; expected balance cleared |
| **TEST-B7** | Verify GL 1115 In-Transit Net 0 | **PASS** | 52ms | GL 1115 Dr ₹9,764 == Cr ₹9,764 (Net ₹0.00) |
| **TEST-C1** | Razorpay Decommission Guard | **PASS** | 22ms | Returns 410 GONE; Cashfree exclusive |
| **TEST-C2** | Create Storefront Customer Order | **PASS** | 195ms | Customer order created (₹110.88) |
| **TEST-C3** | Verify Order in Admin Register | **PASS** | 64ms | Appears in Admin ERP Orders Register |
| **TEST-C4** | Verify Order in Branch Queue | **PASS** | 71ms | Appears in Branch Operations Queue |
| **TEST-C5** | Cashfree Webhook Payment Capture | **PASS** | 280ms | HMAC verified; order confirmed; KOT generated |
| **TEST-C6** | Duplicate Webhook Idempotency | **PASS** | 58ms | Deduplicated safely via idempotent ledger |
| **TEST-C7** | Branch Kitchen KOT Modal | **PASS** | 65ms | Synchronized KOT number returned |
| **TEST-C8** | Statutory CH Invoice Allocation | **PASS** | 310ms | Allocated `CH/26-27/XXXXXX` on delivery |
| **TEST-C9** | Balanced Sales Revenue Voucher | **PASS** | 62ms | Balanced POSTED SALES voucher (`Dr 2141 / Cr 4110+2121+2122`) |
| **TEST-C10**| Profit & Loss Recognition | **PASS** | 95ms | Sales revenue recognized in P&L |
| **TEST-D1** | Inventory Movement Sync | **PASS** | 110ms | Synced across `branch_inventory` and `inventory_movement` |
| **TEST-E1** | Internal Bank Transfer (CONTRA) | **PASS** | 185ms | Source -₹25,000, Dest +₹25,000 atomically |
| **TEST-E2** | Bank Transaction Registers | **PASS** | 72ms | Reflects TRANSFER_OUT and TRANSFER_IN |
| **TEST-F1** | Outbox Processor & Receipts | **PASS** | 145ms | Published pending events; recorded consumer receipts |
| **TEST-F2** | Customer RBAC Isolation | **PASS** | 55ms | Customer sees own orders and 0 internal banking events |
| **TEST-F3** | Branch Tenant Isolation | **PASS** | 60ms | Koramangala manager sees 0 Indiranagar events |
| **TEST-F4** | Real-Time SSE Stream | **PASS** | 85ms | SSE endpoint streams with `text/event-stream` |
| **TEST-F5** | Outbox Dead-Letter Alert | **PASS** | 95ms | Max retries -> DEAD_LETTER -> CRITICAL monitoring alert |
| **TEST-F6** | Dead-Letter Operator Replay | **PASS** | 120ms | Replayed to PUBLISHED; alert marked RESOLVED |
| **TEST-G1** | Global General Ledger Balance | **PASS** | 80ms | Debits ₹1344610.40 == Credits ₹1344610.40 across 69 lines |
| **TEST-G2** | Protected Baseline (cth_test) | **PASS** | 45ms | 100% untouched (127 orders, 71 invoices, 40 payments, 0 writes) |
