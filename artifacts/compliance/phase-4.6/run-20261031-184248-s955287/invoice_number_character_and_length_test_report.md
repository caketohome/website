# Invoice Number Character and Length Test Report
**Test Suite:** `test_phase4_6_serial_compliance.cjs`  
**Target:** `cth_rehearsal_phase4_6`  
**Executed Tests:** 15  
**Passed Tests:** 15 (100.0%)  

---

## 1. Test Execution Results

| Test ID | Test Scenario | Input String | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `TEST-P46-SER-01` | Standard 3-char prefix, 6-digit sequence | `CTH/26-27/000001` | Length 16, Valid | Length 16, Valid | **PASS** |
| `TEST-P46-SER-02` | 2-char prefix, 7-digit sequence | `CT/26-27/0000001` | Length 16, Valid | Length 16, Valid | **PASS** |
| `TEST-P46-SER-03` | 4-char prefix, 5-digit sequence | `CTHI/26-27/00001` | Length 16, Valid | Length 16, Valid | **PASS** |
| `TEST-P46-SER-04` | Hyphenated prefix | `C-T/26-27/000001` | Length 16, Valid | Length 16, Valid | **PASS** |
| `TEST-P46-SER-05` | Shorter valid serial | `CTH/26-27/01` | Length 12, Valid | Length 12, Valid | **PASS** |
| `TEST-P46-SER-06` | Reject 17-char serial | `CTHI/26-27/000001` | Rejected (Length 17) | Rejected (Length 17) | **PASS** |
| `TEST-P46-SER-07` | Reject historical CONC | `CONC/26-27/000001` | Rejected (Length 17) | Rejected (Length 17) | **PASS** |
| `TEST-P46-SER-08` | Reject historical SAFE-TEST | `SAFE-TEST/26-27/000001` | Rejected (Length 22) | Rejected (Length 22) | **PASS** |
| `TEST-P46-SER-09` | Reject sequence overflow | `CTH/26-27/1000000` | Rejected (Length 17) | Rejected (Length 17) | **PASS** |
| `TEST-P46-SER-10` | Reject underscore | `CTH_26-27/000001` | Rejected (Invalid Char)| Rejected (Invalid Char)| **PASS** |
| `TEST-P46-SER-11` | Reject space | `CTH /26-27/00001` | Rejected (Invalid Char)| Rejected (Invalid Char)| **PASS** |
| `TEST-P46-SER-12` | Reject period/dot | `CTH.26-27.000001` | Rejected (Invalid Char)| Rejected (Invalid Char)| **PASS** |
| `TEST-P46-SER-13` | Reject colon | `CTH:26-27:000001` | Rejected (Invalid Char)| Rejected (Invalid Char)| **PASS** |
| `TEST-P46-SER-14` | Reject Unicode symbol | `CTH/26-27/00001₹` | Rejected (Invalid Char)| Rejected (Invalid Char)| **PASS** |
| `TEST-P46-SER-15` | Reject empty string | `""` | Rejected (Empty) | Rejected (Empty) | **PASS** |
