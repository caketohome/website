# CH INVOICE SERIES FINAL SPECIFICATION
**Prefix:** `CH` (Selected Business Preference, replacing CTH, C2H, CTHI)  
**Proposed Format:** `CH/26-27/000001`  
**Statutory Ceiling:** 16 characters max under Rule 46(b) of CGST Rules, 2017  

### Specification Invariants:
1. **Prefix:** `CH` (2 characters).
2. **Fiscal Year Notation:** `26-27` (5 characters, April 1 to March 31 boundary).
3. **Serial Length Range:**
   - Minimum 6 digits (`000001` to `999999`): Total invoice length = **15 characters**.
   - 7-digit expansion (`1000000` to `9999999`): Total invoice length = **16 characters** (exact statutory maximum).
   - 8-digit overflow ($ge 10,000,000$): Strictly **REJECTED** with `STATUTORY_CAPACITY_EXCEEDED`.
4. **Runway:** **9,999,999 invoices/year** per GSTIN.
5. **Leading Zeros:** Preserved for 6 digits; no wrapping or unexpected truncation.