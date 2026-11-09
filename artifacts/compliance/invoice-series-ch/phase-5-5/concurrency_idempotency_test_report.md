# CONCURRENCY AND IDEMPOTENCY TEST REPORT
**Test Environment:** `cth_rehearsal_phase5_5`  

### Empirical Results:
1. **Idempotency Assertion:**
   - Re-requesting allocation for order `ord_idemp_p55` returned identical serial `CH/26-27/000101` (Sequence: 101).
   - Sequence was not incremented; 0 gaps created.
2. **10-Worker Concurrency Stress Test:**
   - 10 parallel clients initiated simultaneous allocations for 10 unique orders.
   - Result: 10 strictly consecutive sequence numbers (102 through 111).
   - Gaps: **0**. Duplicate collisions: **0**. Deadlocks: **0**.
3. **Atomic Rollback:**
   - Transaction abort cleanly rolled back order creation without orphaned state.