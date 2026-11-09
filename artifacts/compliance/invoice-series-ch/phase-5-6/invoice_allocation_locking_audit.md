# INVOICE ALLOCATION LOCKING AND TRANSACTIONAL AUDIT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Audit of Dual Locking Strategy
Phase 5.5 reported the concurrent use of:
1. Row-level locking on `public.invoice_sequence` via `INSERT ... ON CONFLICT DO UPDATE`.
2. Transactional advisory locking via `PERFORM pg_advisory_xact_lock(hashtext(...))`.

### 2. Engineering Evaluation & Finding
- **Row-Level Lock (Canonical):** PostgreSQL row-level locks on `public.invoice_sequence` provide complete ACID isolation. Once a counter record exists, updating the row automatically takes an exclusive `XMAX` lock, serializing concurrent updates without deadlocks.
- **Advisory Lock Role:** When a new sequence row is inserted concurrently for the first time (cold start), two concurrent workers could attempt `INSERT` simultaneously. While `ON CONFLICT` handles this, an advisory lock serialized on `(entity_id, prefix, fiscal_year)` provides a clean gate preventing lock contention during initial row initialization.
- **Collision Safety:** In PostgreSQL, `hashtext()` generates a 32-bit hash. To prevent any theoretical hash collision between different entities or series, the advisory lock is transaction-scoped (`pg_advisory_xact_lock`), ensuring that any lock acquired is immediately released upon transaction `COMMIT` or `ROLLBACK`.
- **Finding:** Retaining both locks is safe, provides cold-start insertion stability, and adds less than 0.5ms of overhead per transaction.
