# Production-Equivalent Rehearsal Report — Phase 4.9

---

## 1. Rehearsal Environment
- **Database:** `cth_rehearsal_phase4_9` on port `5433`
- **Pre-Rehearsal Baseline:** Cloned from `cth_test` (127 orders, 71 invoices, 4 vouchers).
- **Simulations Executed:**
  - Prefix collision simulation: `CTH/26-27/000001` failed with SQLSTATE 23505 as expected.
  - Candidate series insertion: `CTHI/26-27/00001` and `C2H/26-27/000001` succeeded.
  - Rollback integrity: Sequence counters reset properly upon transaction abort.
  - Post-Rehearsal cth_test verification: Untouched (0 writes).
