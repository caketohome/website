# INVOICE SERIES CAPACITY & WARNING THRESHOLD ANALYSIS
**Statutory Constraint:** Maximum 16 characters under CGST Rule 46(b).  
**Status:** DRAFT — PROPOSAL PENDING FORMAL BOARD ADOPTION & PROFESSIONAL CLEARANCE  

## Capacity Breakdown
- **Selected Series `CH` (6-Digit Min -> 7-Digit Expansion):** Runway of **9,999,999 invoices** per financial year.
  - Length at 6 digits (`CH/26-27/000001` to `CH/26-27/999999`): **15 characters**.
  - Length at 7 digits (`CH/26-27/1000000` to `CH/26-27/9999999`): **16 characters** (exact statutory limit).
  - At projected volume of 2,500 orders/day: ~4,000 days runway (~10.9 years of continuous growth within a single FY).
  - Serials >= 10,000,000 (8 digits, 17 characters) are rejected as exceeding the statutory limit.
- **Superseded Option `C2H` (Fixed 6 digits):** Runway of 999,999 invoices per FY (16 characters).
- **Superseded Option `CTHI` (Fixed 5 digits):** Runway of 99,999 invoices per FY (16 characters).

## Sequence Exhaustion Thresholds
- **Warning Threshold (80%):** Alert triggered at sequence **7,999,999** to Finance Approver and System Administrator.
- **Critical Threshold (95%):** Escalation triggered at sequence **9,499,999**.
- **Hard Statutory Guard (100%):** Sequence increments beyond **9,999,999** are blocked with `STATUTORY_CAPACITY_EXCEEDED` to guarantee zero violation of CGST Rule 46(b).
