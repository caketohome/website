# CONCURRENCY AND IDEMPOTENCY TEST RESULTS
**Test Environment:** `cth_rehearsal_series_ch` on `127.0.0.1:5433`  

---

## 1. Idempotency Verification
- **Test:** Invoking `allocate_invoice_number` with identical `order_id` (`ord_idemp_check`) in succession.
- **Result:**
  - Call 1: `CH/26-27/000101` (Sequence: 101)
  - Call 2: `CH/26-27/000101` (Sequence: 101)
- **Outcome:** **PASSED**. Exactly one sequence number consumed; duplicate requests return cached allocation without advancing counter.

---

## 2. High-Concurrency Stress Test (10 Parallel Workers)
- **Test:** 10 asynchronous concurrent client connections allocating numbers simultaneously for distinct orders.
- **Results:**
  - 10 distinct invoice numbers generated: `CH/26-27/000102` through `CH/26-27/000111`.
  - Zero duplicate numbers (10 unique).
  - Zero sequence gaps (strictly consecutive: 102, 103, 104, 105, 106, 107, 108, 109, 110, 111).
  - Zero transaction deadlocks.
- **Outcome:** **PASSED**. `pg_advisory_xact_lock` successfully serialized allocation transactions.

---

## 3. Transaction Rollback Handling
- **Test:** Initiating an explicit SQL transaction (`BEGIN`), allocating an invoice number, and executing an explicit `ROLLBACK`.
- **Outcome:** **PASSED**. Order creation was aborted, and database state rolled back cleanly without corrupting sequence continuity.