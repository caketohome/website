# CAKETOHOME — APPLICATION DEPENDENCY & INTERACTION REGISTER
**Project:** CakeToHome Enterprise Suite  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. INTER-MODULE DEPENDENCY MATRIX
The table below specifies every upstream and downstream relationship between business modules:

| Source Module | Dependent Module | Interaction Type | Data Contract | Fallback / Isolation Control |
| :--- | :--- | :--- | :--- | :--- |
| **Storefront Order** | Admin Orders | Synchronous REST | Order JSON (Items, Pricing, Slot) | Atomic DB commit in `public.order` |
| **Cashfree Webhook** | Order Fulfillment | Async HMAC Webhook | `PAYMENT_SUCCESS_WEBHOOK` | Idempotent ledger in `payment_webhook_event` |
| **Cashfree Webhook** | Store Kitchen | DB Transaction | Auto-generates KOT in `kot_tickets` | `ON CONFLICT (order_id) DO NOTHING` |
| **Cashfree Webhook** | Inventory | DB Transaction | Decrements `branch_inventory`, logs `inventory_movement` | CHECK (quantity >= 0) |
| **Cashfree Webhook** | Accounting | DB Transaction | Posts `1113` Clearing -> `2141` Customer Advance | Balanced Voucher & Journal Entry |
| **Order Delivery** | Invoicing Engine | DB Transaction | Allocates `CH/26-27/XXXXXX` statutory series | Atomic lock on `invoice_sequence` |
| **Order Delivery** | Financial Ledger | DB Transaction | Posts Revenue Recognition (`Dr 2141` / `Cr 4110` + `Cr 2121` + `Cr 2122`) | Balanced Voucher & Journal Entry |
| **Bank Creation** | Chart of Accounts | DB Transaction | Auto-creates child GL account under `1110` (`1112-XX`) | Unique GL code constraint |
| **Bank Creation** | Opening Balance | DB Transaction | Posts balanced JV against `3300` Opening Balance Equity | Trial balance balanced check |
| **Cashfree Payout** | Settlement Ledger | REST Ingestion | `batch_ref`, `gross_amount`, `gateway_fee`, `net_amount` | Expected settlement balance increment |
| **Bank Statement** | Bank Reconciliation | REST UTR Match | `utr_number`, `credit_amount`, `statement_date` | Clears `1115` into physical bank GL `1112` |
| **Bank Transfer** | Bank Registers | DB Transaction | Contra Voucher debiting destination & crediting source | Atomic balance updates on both accounts |

---

## 2. RESILIENCE & FAILURE BLAST RADIUS
- **Database Partitioning:** All operations occur within isolated ACID transactions. A failure in kitchen ticket printing or inventory deduction cleanly rolls back the payment capture mutation.
- **Circuit Breaking:** The Next.js API Gateway includes active health probes for the NestJS backend (`/health`). If the NestJS port is temporarily unreachable, the gateway executes authoritative database fallbacks without failing user requests.
- **Dead-Letter Recovery:** If an outbox consumer fails 5 consecutive times, the event is automatically marked `DEAD_LETTER`, an alert is posted to `public.system_monitoring_alert`, and operators can replay via `POST /api/v1/events/replay`.
