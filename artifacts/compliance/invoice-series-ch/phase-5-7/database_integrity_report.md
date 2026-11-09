# DATABASE INTEGRITY REPORT
**Milestone:** Phase 5.7 Onward: Finalization, Corporate & Professional Clearance, Production Readiness, Controlled Release and Project Closure  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-204500-s570001`](file:///e:/vig/.arena/run-20261102-204500-s570001) | **Seed:** `570001` | **Champion:** `a001` (`First principles + Build, then break + Edge cases first`)  
**Skill-Router Execution ID:** `sr-20261102-204500-p57`  
**Actual PostgreSQL Version:** `PostgreSQL 16.14, compiled by Visual C++ build 1944, 64-bit` (verifying ground truth against historical 17.11 report)  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_7` (19/19 tests passed 100%)  


### 1. Cryptographic Baseline Invariance of cth_test
| Table | Rows Pre | Rows Post | MD5 Pre-Rehearsal | MD5 Post-Rehearsal | Status |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `order` | 127 | 127 | `6d9182dd2a34cdc088f1701b2a504873` | `6d9182dd2a34cdc088f1701b2a504873` | **INVARIANT (0 writes)** |
| `invoice` | 71 | 71 | `e33ce42618e680c9b266e02a52e77026` | `e33ce42618e680c9b266e02a52e77026` | **INVARIANT (0 writes)** |
| `accounting_voucher` | 4 | 4 | `db3f00816abfe902347a65745f1c0b2a` | `db3f00816abfe902347a65745f1c0b2a` | **INVARIANT (0 writes)** |
