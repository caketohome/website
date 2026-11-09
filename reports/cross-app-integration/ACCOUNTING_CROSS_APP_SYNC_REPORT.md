# CAKETOHOME — ACCOUNTING CROSS-APPLICATION SYNCHRONIZATION REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. BANK ACCOUNT & CHART OF ACCOUNTS LIFECYCLE
When a company bank account is added via `POST /api/v1/accounting/bank-accounts`:
1. **Master Record:** Created in `public.bank_account` with masked account number (`•••• 3344`).
2. **Dedicated GL Account:** Auto-created in `public.accounting_account` under group `1110 (Bank Accounts)` with code `1112-XX`, type `ASSET`, subtype `BANK`.
3. **Balanced Opening Voucher:** When opening balance > 0 (e.g. ₹1,25,000.00), an atomic voucher (`vch_ob_...`) and journal entry are created:
   - **Debit:** Mapped Bank GL Account (`1112-XX`) = ₹1,25,000.00
   - **Credit:** Opening Balance Offset Equity (`3300`) = ₹1,25,000.00
4. **Bank Transaction Register:** An initial `OPENING_BALANCE` transaction is recorded in `public.bank_transaction`.
5. **Immediate Report Propagation:** The bank opening balance immediately flows into:
   - **Chart of Accounts:** `GET /api/v1/admin/accounting/accounts`
   - **General Ledger:** `GET /api/v1/admin/accounting/general-ledger?account_id=...`
   - **Trial Balance:** `GET /api/v1/admin/accounting/trial-balance` (Debits == Credits, Difference = 0)
   - **Balance Sheet:** `GET /api/v1/admin/accounting/balance-sheet` (Included in Current Assets)
   - **Cash Flow Statement:** `GET /api/v1/admin/accounting/cash-flow` (Closing cash matches Balance Sheet bank + cash)

---

## 2. INTERNAL BANK TRANSFER (CONTRA VOUCHER)
Transfers between company bank accounts (`POST /api/v1/accounting/bank-transfers`) post balanced CONTRA vouchers:
- **Debit:** Destination Bank GL (`1112-XX`) = ₹25,000.00
- **Credit:** Source Bank GL (`1112 Primary`) = ₹25,000.00
- **Source Register:** Recorded as `TRANSFER_OUT` with updated running balance.
- **Destination Register:** Recorded as `TRANSFER_IN` with updated running balance.
