# Invoice Allocation Concurrency and Failure Tests — Phase 4.2 Independent Forensic Audit

## 1. Concurrency Architecture & Advisory Locking

Statutory sequence allocation in PostgreSQL requires strictly monotonic incrementation without race conditions, sequence collisions, or deadlock convoying.

### 1.1 Lock Scheme Analysis
In [`public.allocate_invoice_number`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql#L101-L103):
```sql
-- Advisory lock serializes per (entity_id, prefix, fiscal_year) to prevent race conditions
PERFORM pg_advisory_xact_lock(hashtext(p_entity_id || '::' || p_prefix || '::' || v_fy::text)::bigint);
```
- **Lock Scope**: Scoped to the tuple `(entity_id, prefix, fiscal_year)`. Transactions for different entities, different series prefixes, or different fiscal years proceed entirely concurrently without blocking.
- **Lock Lifetime**: Transaction-scoped (`_xact_`). PostgreSQL automatically and unconditionally releases the advisory lock at transaction termination (`COMMIT` or `ROLLBACK`), preventing orphaned locks across connection pool reuse.
- **Hash Space Collisions**: Evaluated in Arena Round 1. PostgreSQL `hashtext()` distributes across 32-bit signed integer values. Even in the theoretical case of a 32-bit hash collision across two distinct series, the transactions merely serialize sequentially without data corruption, as the subsequent `UPDATE public.invoice_sequence` explicitly matches the unique composite key `(entity_id, gstin, fiscal_year, prefix)`.

---

## 2. Concurrency Test Execution & Evidence

A real-time concurrency load test was executed on `cth_disposable_phase4_2` with 10 asynchronous worker clients submitting simultaneous allocation requests for 10 distinct orders.

Evidence log: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/test_phase4_2_compliance.log`](file:///e:/vig/.arena/scratch/test_phase4_2_compliance.js)

### Concurrency Test Results:
```json
[
  "SAFE-TEST/26-27/000005",
  "SAFE-TEST/26-27/000006",
  "SAFE-TEST/26-27/000007",
  "SAFE-TEST/26-27/000008",
  "SAFE-TEST/26-27/000009",
  "SAFE-TEST/26-27/000010",
  "SAFE-TEST/26-27/000011",
  "SAFE-TEST/26-27/000012",
  "SAFE-TEST/26-27/000013",
  "SAFE-TEST/26-27/000014"
]
```
- **Deadlocks Observed**: 0
- **Unique Numbers**: 10 / 10
- **Contiguity**: Contiguous sequence from 5 to 14.
- **Outcome**: **VERIFIED PASS**.

---

## 3. Idempotency and Zero Sequence Burning

Repeated delivery events for the same order (`ord_test_safe_01`) were tested:
1. **Initial Allocation**: Allocated `SAFE-TEST/26-27/000004` (sequence value 4).
2. **Replayed Allocation**: Submitting identical payload returned `SAFE-TEST/26-27/000004` (sequence value 4).
3. **Database Counter Verification**: `last_seq` in `public.invoice_sequence` remained at 4.
4. **Outcome**: **VERIFIED PASS** — Zero sequence burning on delivery event retries.

---

## 4. Sequence Gaps and Failure Recovery Analysis

| Failure Scenario | System Behavior | Sequence Gap Risk | Recovery / Mitigation |
| :--- | :--- | :---: | :--- |
| **Rollback during Invoice Insertion** | PostgreSQL rolls back entire transaction including `last_seq` update | **ZERO** | Single transactional boundary prevents gap creation. |
| **Worker Process Crash before Commit** | Transaction aborts; connection terminated; lock released by PostgreSQL | **ZERO** | Sequence counter is not committed; next worker allocates cleanly. |
| **Network Disconnection after Commit** | Transaction committed in DB; worker retries order delivery | **ZERO** | Idempotency guard finds existing allocation log and returns committed invoice number without incrementing. |
| **Administrative Deprecation of Series** | Subsequent requests fail closed with `UNAUTHORIZED_INVOICE_SERIES` | **ZERO** | Sequence freezes at current value; audit log records last issued invoice. |

