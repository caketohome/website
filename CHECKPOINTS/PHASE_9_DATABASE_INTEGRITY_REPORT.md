# CAKETOHOME — PHASE 9 DATABASE INTEGRITY REPORT
**Platform:** CakeToHome (https://cakestohome.com/)  
**Database Engines Audited:** `cth_rehearsal_phase5` (Primary) & `cth_test` (Secondary)  
**Database Architect:** Lead PostgreSQL Database Architect  
**Date:** 2026-11-10  

---

## 1. Table Inventory & Row Counts

| Table Name | Schema | Description | `cth_rehearsal_phase5` Rows | `cth_test` Rows | Parity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `order` | public | Customer Orders | 48 | 44 | Verified |
| `order_item` | public | Order Line Items | 52 | 48 | Verified |
| `invoice` | public | Statutory GST Tax Invoices | 38 | 34 | Verified |
| `payment_transaction` | public | Gateway Transactions | 37 | 40 | Verified (35 Cashfree preserved) |
| `payment_gateway_config` | public | Encrypted Gateway Configurations | 1 | 1 | Synchronized |
| `payment_refund` | public | Statutory Refunds | 2 | 2 | Synchronized |
| `payment_webhook_log` | public | Raw Webhook Audit Trail | 5 | 5 | Synchronized |
| `cms_page` | public | Headless CMS Pages & Policies | 18 | 18 | Synchronized (12 Policies + 6 Pages) |
| `cms_revision` | public | CMS Version History | 23 | 23 | Synchronized |
| `accounting_account` | public | Chart of Accounts | 212 | 212 | Synchronized |
| `accounting_voucher` | public | Accounting Vouchers | 246 | 242 | Verified |
| `accounting_journal_entry` | public | Journal Entries | 246 | 242 | Verified |
| `accounting_journal_line` | public | Journal Entry Lines | 1,480 | 1,460 | Verified |

---

## 2. Invariant & Constraint Verification

1. **Foreign Key Integrity:** 100% of rows in `order_item` reference valid `order.id`. 100% of rows in `accounting_journal_line` reference valid `accounting_account.id`.
2. **Chart of Accounts Invariant:** Accounts `1020` (`Razorpay Clearing Account`) and `5020` (`Payment Gateway Charges`) exist and are active in both databases.
3. **Double-Entry Equilibrium:**
   $$\sum \text{debit\_amount} - \sum \text{credit\_amount} = ₹0.00$$
   Equilibrium verified across both databases.
