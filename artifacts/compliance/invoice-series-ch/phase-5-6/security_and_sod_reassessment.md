# SECURITY AND SEGREGATION OF DUTIES REASSESSMENT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Segregation of Duties (SoD) Framework
- Requirement: The individual requesting invoice series activation cannot be the individual authorizing it (`requester_id != approver_id`).
- Human Identity Verification: Automated scripts, service accounts, and API callers cannot grant Layer 5 authorization.
- Cryptographic Signature: Approvals must be attributable to authenticated individuals with verified corporate roles (Director, Company Secretary, or Authorized Signatory).

### 2. Privilege & Direct Access Defenses
- Security Definer Execution: `public.allocate_invoice_number` executes as `SECURITY DEFINER` with fixed `search_path = 'public', 'pg_temp'` to prevent search path hijacking.
- Role-based isolation ensures unprivileged callers cannot alter counter rows directly.
