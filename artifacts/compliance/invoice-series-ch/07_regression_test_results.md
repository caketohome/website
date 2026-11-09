# REGRESSION TEST RESULTS: SERIES 'CH' REHEARSAL
**Test Suite:** `test_invoice_series_ch.cjs`  
**Target Rehearsal DB:** `cth_rehearsal_series_ch`  
**Protected DB Check:** `cth_test`  

---

## Execution Summary
- **Total Tests Executed:** 18
- **Passed:** 18 (100%)
- **Failed:** 0
- **Pass Rate:** **100%**

### Granular Test Breakdown:
1. Baseline Pre-check on `cth_test`: **PASSED** (127 orders, 71 invoices, 4 vouchers)
2. Governance Fail-Closed Guard (Proposed CH blocked while unapproved): **PASSED**
3. Initial Sequence 6-Digit Padding (`CH/26-27/000001`, 15 chars): **PASSED**
4. Upper 6-Digit Boundary (`CH/26-27/999999`, 15 chars): **PASSED**
5. 7-Digit Boundary Expansion (`CH/26-27/1000000`, 16 chars): **PASSED**
6. Upper 7-Digit Boundary (`CH/26-27/9999999`, 16 chars): **PASSED**
7. 8-Digit Overflow Rejection (`10000000` blocked by capacity guard): **PASSED**
8. Idempotency Assertion (repeated calls return cached serial): **PASSED**
9. Concurrency Test (10 parallel workers, 0 gaps, 0 duplicates): **PASSED**
10. Financial Year Isolation (`/26-27/` vs `/27-28/`): **PASSED**
11. Atomic Rollback Handling: **PASSED**
12. Audit History Logging (`invoice_allocation_log`): **PASSED**
13. Business-Wide Numbering across Channels & Branches: **PASSED**
14. Historical Collision Invoice Preservation (`inv_1792901376459_xlxkf`): **PASSED**
15. Historical `CTH` Prefix Conflict Blocked: **PASSED**
16. Historical 69 Unbilled Orders Untouched (21 delivered quarantined): **PASSED**
17. Anti-Reuse Invariant (cancelled invoice serial cannot be reused): **PASSED**
18. Baseline Post-check on `cth_test` (Zero writes verified, hashes invariant): **PASSED**