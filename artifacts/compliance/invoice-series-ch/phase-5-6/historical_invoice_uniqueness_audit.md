# HISTORICAL INVOICE UNIQUENESS AUDIT REPORT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Historical Collision Record Preservation
- Legacy invoice record `inv_1792901376459_xlxkf` holding `CTH/26-27/000001` under dummy GSTIN `29AAACC1234F1Z5` was verified intact.
- Because the approved production series uses prefix `CH` under authentic Karnataka GSTIN `29AABCC1234F1Z5`, there is zero namespace collision.

### 2. Uniqueness Constraint Audit
- Table `public.invoice` maintains unique constraint `invoice_invoice_number_key` on `invoice_number`.
- Test T17 verified that attempting to reuse a cancelled invoice number (`CH/26-27/000888`) for a different order is hard-blocked at the storage engine level.
- Multi-GSTIN isolation verified: Different registrations maintain strictly distinct sequences (e.g. `MH/26-27/000001` for Maharashtra vs `CH/26-27/...` for Karnataka).
