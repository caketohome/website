# CAKETOHOME — ACCOUNTING RECONCILIATION REPORT
## Double-Entry Ledger, Voucher Posting & Settlement Variance

### 1. Reconciliation Invariant
For every confirmed order:
```
Order Grand Total == Sum of Captured Payment Transactions (Variance = 0.00 INR)
```
Verified in rehearsal testing with exact match:
- Order Total: 454.65 INR
- Captured Payment: 454.65 INR
- Variance: 0.00 INR

### 2. General Ledger Posting
- Receipt voucher posted to `public.accounting_voucher` with type `RECEIPT` and status `POSTED`.
- Linked to order via `reference_type = 'ORDER'` and `reference_id = order_id`.
- Audit integrity: `created_by = 'finance_service'`.
