# GSTR-1 RECONCILIATION SOP DRAFT (BDR-10)
**Objective:** Monthly reconciliation between ERP invoice allocation log and GSTR-1 Table 13.  

## Procedure
1. On 1st of each calendar month, generate `InvoiceAllocationLog` extract for previous month.
2. Reconcile total serials issued against active `public.invoice` count.
3. Verify zero missing sequence gaps or duplicate serial numbers.
4. Chartered Accountant reviews and signs reconciliation certificate prior to portal filing.
