# INVOICE ALLOCATION INTEGRITY REPORT
**Allocation Engine:** Atomic Stored Procedure with Fail-Closed Status Guards  

### Allocation Steps & Transaction Boundary:
1. **Statutory Validation:** Regex verification of seller GSTIN (15 chars, State Code 29).
2. **Fiscal Year Determination:** Indian fiscal year evaluated under `Asia/Kolkata` timezone.
3. **Advisory Transaction Lock:** Serializes concurrent requests per `(entity_id, prefix, fiscal_year)`.
4. **Idempotency Check:** Existing order allocation returned immediately without incrementing counter.
5. **Approval Guard:** Unapproved series (`approval_status <> 'APPROVED'` or `is_active = false`) fail closed with `UNAUTHORIZED_INVOICE_SERIES`.
6. **Atomic Increment:** Updates `last_seq = invoice_sequence.last_seq + 1` returning new sequence.
7. **Capacity Guard:** Rejects sequence $> 9999999$.
8. **Audit Logging:** Inserts record in `public.invoice_allocation_log`.