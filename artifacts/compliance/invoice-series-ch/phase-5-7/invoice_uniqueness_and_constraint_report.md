# INVOICE UNIQUENESS AND CONSTRAINT AUDIT REPORT
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


### 1. Storage-Level Constraints
- **Table:** `public.invoice`
  - `invoice_pkey`: PRIMARY KEY (`id`)
  - `invoice_invoice_number_key`: UNIQUE (`invoice_number`)
  - `invoice_order_id_key`: UNIQUE (`order_id`)
- **Uniqueness Invariant:** The database enforces absolute global uniqueness on `invoice_number`. Even if an application bug attempted duplicate issuance, the storage engine blocks insertion with SQLSTATE `23505`.
- **Anti-Reuse Guarantee:** Test T17 proved that cancelled invoice numbers cannot be re-allocated or re-inserted for another order.
