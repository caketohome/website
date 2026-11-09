# ACCOUNTING RECONCILIATION REPORT
**General Ledger Engine:** Double-Entry Accounting Module  

### Invariants:
1. **Voucher Linkage:** Every issued invoice links to `public.accounting_voucher` via `reference_type = 'SALES'` and `reference_id = invoice_number`.
2. **Balanced Debits and Credits:** Sales posting enforces $\sum \text{Debits} = \sum \text{Credits}$ across Accounts Receivable, Output CGST (2211), Output SGST (2212), and Sales Revenue (4110).
3. **Compensating Reversals:** Posted invoices are immutable. Cancellations generate a compensating reversal voucher (`reference_type = 'SALES_REVERSAL'`) rather than deleting historical records.
4. **Credit Notes:** Handled via `sales-return.service.ts` with distinct credit note vouchers; original invoice numbers are never reused.