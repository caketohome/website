# CH INVOICE SERIES TECHNICAL SPECIFICATION
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


### 1. Canonical Pattern: `CH/{FY}/{SERIAL}`
- **Prefix:** `CH` (2 characters, representing CakeToHome)
- **Delimiter:** `/` (1 character, CGST Rule 46(b) allowed special character)
- **Financial Year:** `26-27` (5 characters, representing April 1, 2026 to March 31, 2027)
- **Delimiter:** `/` (1 character)
- **Serial Counter:** 6 to 7 digits
  - Initial Range: `000001` to `999999` (6 digits zero-padded) -> Total length = **15 characters**.
  - Expansion Range: `1000000` to `9999999` (7 digits natural) -> Total length = **16 characters**.
- **Technical Ceiling:** Complete invoice number $\le 16$ characters. Serials $\ge 10,000,000$ (17 characters) are hard-rejected before persistence.
