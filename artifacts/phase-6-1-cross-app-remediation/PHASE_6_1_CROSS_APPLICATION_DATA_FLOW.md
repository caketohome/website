# PHASE 6.1 — CROSS-APPLICATION DATA FLOW

The CakeToHome ecosystem synchronizes all actions through shared PostgreSQL transactional tables:
1. **Customer Order Placed:** Writes to `public.order`, generates Cashfree order token.
2. **Payment Realized:** Cashfree webhook verifies signature, updates `public.order` (status: PAID), inserts into `public.invoice`.
3. **Accounting Posting:** Auto-creates journal lines in `public.accounting_journal_line` (Dr Gateway Clearing `1113`, Cr Output CGST `2121`, Cr Output SGST `2122`, Cr Revenue `4110`).
4. **Kitchen Notification:** Kitchen queue at `/branch-manager` dynamically reads order with zero manual intervention.
