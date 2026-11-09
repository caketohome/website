# First Production Invoice Validation Plan
**Procedure:** Controlled Verification of Initial Live Invoicing Transaction  

---

## 1. 7-Stage First Invoice Verification Protocol
1. **Trigger Condition:** First order transitions to status `DELIVERED`.
2. **Immediate Lock Verification:** Ensure advisory lock is acquired on series row.
3. **Sequence Continuity Check:** Verify `last_seq` increments from 0 to 1.
4. **Format & Length Validation:** Confirm invoice number matches `[PREFIX]/26-27/000001` and total character length <= 16 characters.
5. **Tax Calculation Check:** Verify 18% GST (9% CGST + 9% SGST for intrastate, 18% IGST for interstate).
6. **Accounting Voucher Posting Check:** Verify corresponding sales voucher is generated and debits/credits balance to 0.00 INR.
7. **Document Rendering Check:** Inspect generated PDF invoice for statutory supplier details, buyer details, and HSN codes.
