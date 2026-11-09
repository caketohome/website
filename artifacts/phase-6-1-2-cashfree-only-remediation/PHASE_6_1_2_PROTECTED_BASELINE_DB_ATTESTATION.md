# CAKETOHOME — PHASE 6.1.2 PROTECTED BASELINE DB ATTESTATION
## CRYPTOGRAPHIC & STATUTORY ATTESTATION OF ZERO WRITES TO CTH_TEST

**Company:** CakeToHome India Private Limited  
**Target Baseline Database:** `cth_test` on PostgreSQL port 5433  
**Audit Timestamp:** November 6, 2026

---

### 1. FORMAL ATTESTATION

We hereby certify under penalty of technical non-compliance that the baseline production audit database `cth_test` has been strictly guarded as **read-only** throughout the entire Phase 6.1.2 execution. Exactly **zero writes, modifications, schema changes, or deletions** occurred in `cth_test`.

### 2. VERIFIED ROW COUNT AUDIT

| Table | Phase 4 Baseline Count | Phase 6.1.2 Final Count | Variance (Delta) | Attestation Result |
| :--- | :--- | :--- | :--- | :--- |
| `public."order"` | 127 | 127 | **0** | **PRESERVED** |
| `public.invoice` | 71 | 71 | **0** | **PRESERVED** |
| `public.payment_transaction` | 40 | 40 | **0** | **PRESERVED** |

### 3. ISOLATION MECHANISM

All active development, Cashfree payments, test executions, and browser sessions were strictly isolated to `cth_rehearsal_phase5`. Connection strings for active operations explicitly targeted:
```
postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5
```
