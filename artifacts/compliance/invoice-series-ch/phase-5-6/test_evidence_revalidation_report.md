# TEST EVIDENCE RE-VALIDATION REPORT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Rehearsal Execution Summary
All 19 tests were executed on disposable rehearsal database `cth_rehearsal_phase5_6`. 

| Test ID | Test Domain | Assertion & Scope | Status |
| :---: | :--- | :--- | :---: |
| **T01** | Formatting | `CH/26-27/000001` formats to 15 characters | **PASS** |
| **T02** | Boundary | `CH/26-27/999999` formats to 15 characters | **PASS** |
| **T03** | Dynamic Expansion | `CH/26-27/1000000` formats to 16 characters with no truncation | **PASS** |
| **T04** | Capacity Ceiling | `CH/26-27/9999999` formats to 16 characters | **PASS** |
| **T05** | Overflow Rejection | `10000000` rejected with `STATUTORY_CAPACITY_EXCEEDED` | **PASS** |
| **T06** | Prefix Validation | Malformed prefix rejected with `INVALID_PREFIX` | **PASS** |
| **T07** | GSTIN Validation | Malformed GSTIN rejected with `STATUTORY_ERROR` | **PASS** |
| **T08** | Idempotency | Replay returns identical invoice number without counter increment | **PASS** |
| **T09** | Concurrency | 10 parallel workers allocate 10 consecutive serials (0 collisions, 0 gaps) | **PASS** |
| **T10** | FY Rollover | April 1 boundary resets sequence to 1 in new fiscal year | **PASS** |
| **T11** | Rollback Safety | Aborted transaction does not corrupt or skip sequence values | **PASS** |
| **T12** | Multi-GSTIN Scope | Maharashtra registration maintains independent sequence | **PASS** |
| **T13** | Cross-GSTIN Conflict | Conflicting prefix claim across GSTINs blocked | **PASS** |
| **T14** | Legacy Record | Historical collision record `inv_1792901376459_xlxkf` intact | **PASS** |
| **T15** | Order Quarantine | 69 unbilled orders remain unbilled and quarantined | **PASS** |
| **T16** | Legal Hold | 21 delivered historical orders held on legal hold | **PASS** |
| **T17** | Anti-Reuse | Duplicate insertion of cancelled invoice number blocked | **PASS** |
| **T18** | Accounting Vouchers | 4 historical vouchers preserved intact | **PASS** |
| **T19** | Baseline Invariance | Protected database `cth_test` verified 100% read-only (0 writes) | **PASS** |
