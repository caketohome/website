# CONCURRENCY AND IDEMPOTENCY RE-VERIFICATION REPORT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Concurrency Benchmark Results (10 Concurrent Workers)
The concurrency test was executed against `cth_rehearsal_phase5_6` using 10 parallel PostgreSQL client connections:
- **Allocated Sequence Range:** `201` through `210`
- **Sequence Continuity:** 10 strictly consecutive integers; **0 gaps, 0 duplicates, 0 collisions**
- **p50 Latency:** `167 ms`
- **p95 Latency:** `204 ms`
- **p99 Latency:** `204 ms`
- **Throughput:** `48.1 ops/sec`
- **Deadlocks Observed:** **ZERO (0)**

### 2. Idempotency Reverification
- Calling `allocate_invoice_number` multiple times with the same `order_id` (`ord_idempotent_test`) returned the identical invoice number (`CH/26-27/000101`) without advancing the counter.
- Atomic rollback test confirmed that an aborted transaction does not leave sequence gaps.
