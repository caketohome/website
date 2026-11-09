# CONCURRENCY TEST REPORT
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


### 1. Test Setup & Execution
- **Environment:** PostgreSQL 16.14 on `127.0.0.1:5433`
- **Target Database:** `cth_rehearsal_phase5_7`
- **Worker Configuration:** 10 parallel client workers executing simultaneous invoice allocations.
- **Allocated Serials:** `201`, `202`, `203`, `204`, `205`, `206`, `207`, `208`, `209`, `210`
- **Results:** 10 strictly consecutive allocations. **0 collisions, 0 gaps, 0 deadlocks**.
