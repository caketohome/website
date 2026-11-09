# CAKETOHOME — BUSINESS DATA SOURCE OF TRUTH REGISTER
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. AUTHORITATIVE SOURCES OF TRUTH
In CakeToHome, data is never stored in disparate silos or fabricated in client memory. The authoritative source of truth for every business entity is defined below:

| Business Domain | Authoritative Entity | PostgreSQL Table | Primary Key | Key Invariant Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Company Banks** | Master Bank Account | `public.bank_account` | `id` (text) | Account number masked; IFSC validated |
| **Bank Balances** | Verified Running Balance | `public.bank_account`, `public.bank_transaction` | `id` (text) | Incremented only via balanced accounting vouchers |
| **Cash in Hand** | Cash Drawer Float | `public.cash_account` | `id` (text) | Mapped to GL 1114 / 1118 |
| **Chart of Accounts**| Accounting Account | `public.accounting_account` | `id` (text) | Unique 4-digit code hierarchy under 1000-5999 |
| **Journal Entries** | General Ledger Line | `public.accounting_journal_line` | `id` (text) | Double-entry balance: SUM(DR) == SUM(CR) |
| **Financial Vouchers**| Accounting Voucher | `public.accounting_voucher` | `id` (text) | Sequenced voucher number; fiscal year bound |
| **Customer Orders** | Sales Order | `public."order"` | `id` (text) | Immutable snapshot of items, tax, and pricing |
| **Kitchen Tickets** | KOT Ticket | `public.kot_tickets` | `id` (text) | Unique `order_id`; unique `kot_number` |
| **Inventory Stock** | Branch Stock | `public.branch_inventory` | `(branch_id, product_id)` | Non-negative constraint; stock >= 0 |
| **Stock Movements** | Inventory Audit Line | `public.inventory_movement` | `id` (text) | Positive quantity; direction in ('IN','OUT') |
| **Tax Invoices** | Statutory Tax Invoice | `public.invoice` | `id` (text) | `CH/YY-YY/XXXXXX` series; CGST Rule 46 compliant |
| **Invoice Sequence** | Allocation Counter | `public.invoice_sequence` | `id` (text) | Advisory lock allocation; zero gaps |
| **Gateway Payouts** | Cashfree Batch | `public.cashfree_settlement_batch` | `id` (text) | Unique `batch_ref`; UTR tracking |
| **Bank Recon** | BRS Session & Match | `public.bank_reconciliation_session` | `id` (text) | Zero variance upon exact UTR match |
| **Outbox Events** | Transactional Outbox | `public.outbox_events` | `id` (bigserial) | Guaranteed at-least-once delivery |

---

## 2. ELIMINATION OF FABRICATION & UNVERIFIED BALANCES
1. **No Fabricated Bank Deposits:** When a Cashfree settlement batch is ingested, `expected_settlement_balance` is incremented on the target bank account, but `current_balance` remains strictly unmodified until an authentic bank statement credit line is matched by UTR.
2. **No Pre-Delivery Invoices:** Invoices are never generated at order placement or payment time. Statutory tax invoices are allocated exclusively when delivery is confirmed.
3. **Double-Entry Enforcement:** No bank account, settlement, or revenue movement can be registered without corresponding balanced journal entries in `public.accounting_journal_line`.
