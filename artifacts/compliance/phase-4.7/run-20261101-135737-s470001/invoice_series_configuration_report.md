# Invoice Series Configuration Report
**Statutory Standard:** CBIC CGST Rule 46(b) ($le 16$ characters, `[A-Za-z0-9/-]`)  

## Candidate Prefix Analysis
### Option 1: Prefix CTH (Historical Collision)
- **Format:** `CTH/26-27/000001` (16 characters).
- **Collision Finding:** Fails in database. Historical invoice `CTH/26-27/000001` already exists under previous entity `29AAACC1234F1Z5`. Unique constraint `invoice_invoice_number_key` causes immediate violation.

### Option 2: Prefix CTHI (Clean Runway)
- **Format:** `CTHI/26-27/00001` (4 prefix + 1 slash + 5 FY + 1 slash + 5 seq = 16 characters).
- **Capacity:** 99,999 invoices per financial year.
- **Collision Finding:** 0 collisions. Starts cleanly at sequence 1.

### Option 3: Prefix C2H (Clean Runway)
- **Format:** `C2H/26-27/000001` (3 prefix + 1 slash + 5 FY + 1 slash + 6 seq = 16 characters).
- **Capacity:** 999,999 invoices per financial year.
- **Collision Finding:** 0 collisions. Starts cleanly at sequence 1.
