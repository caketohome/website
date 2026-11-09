# Rehearsal Database Verification Report
**Database:** `cth_rehearsal_phase4_7`  
**Cloned From:** `cth_test`  

## Verification Steps
1. Disconnected active sessions and dropped stale rehearsal instance.
2. Cloned fresh database from template `cth_test`.
3. Verified initial table counts: 127 orders, 71 invoices, 4 vouchers.
4. Executed all Phase 4.7 tests against rehearsal database.
5. Re-verified protected `cth_test` baseline: SHA-256 digests 100% identical.
