# GST FORMAT VALIDATION EVIDENCE
**Statutory Authority:** Rule 46(b) of the Central Goods and Services Tax (CGST) Rules, 2017  
**Legal Entity:** CakeToHome India Private Limited (GSTIN: `29AABCC1234F1Z5`)  

---

## 1. Statutory Compliance Matrix
| CGST Rule 46(b) Requirement | Specification in Series 'CH' | Rehearsal Verification Result | Status |
| :--- | :--- | :--- | :---: |
| Consecutive serial number | Transactional sequence counter with atomic locking | Strictly consecutive numbers (102-111 tested) | **COMPLIANT** |
| Unique for a financial year | Scoped by `(entity_id, gstin, fiscal_year, prefix)` | FY 2026 (`/26-27/`) vs FY 2027 (`/27-28/`) isolated | **COMPLIANT** |
| Max length $\le$ 16 characters | 6-digit band: 15 chars; 7-digit band: 16 chars | 8-digit attempts (>16 chars) blocked by database | **COMPLIANT** |
| Permitted character set | Alphabets, numerals, slashes, hyphens | `CH/26-27/XXXXXX` contains only permitted characters | **COMPLIANT** |

---

## 2. Boundary Condition Test Evidence
All boundary conditions were tested and verified against rehearsal database `cth_rehearsal_series_ch`:

| Test Case | Simulated Sequence | Generated Invoice Number | Exact Length | Expected Behavior | Actual Rehearsal Result |
| :--- | :---: | :--- | :---: | :--- | :--- |
| Initial Sequence | `1` | `CH/26-27/000001` | 15 chars | 6 digits, zero-padded | **PASSED** |
| Mid-band 6 digits | `500000` | `CH/26-27/500000` | 15 chars | 6 digits preserved | **PASSED** |
| Upper 6-digit boundary | `999999` | `CH/26-27/999999` | 15 chars | 6 digits preserved | **PASSED** |
| 7-digit Expansion | `1000000` | `CH/26-27/1000000` | 16 chars | Expands to 7 digits, NO TRUNCATION | **PASSED** |
| Upper 7-digit boundary | `9999999` | `CH/26-27/9999999` | 16 chars | Exact statutory 16-char ceiling | **PASSED** |
| 8-digit Overflow | `10000000` | Exception raised | N/A | `STATUTORY_CAPACITY_EXCEEDED` | **PASSED (BLOCKED)** |