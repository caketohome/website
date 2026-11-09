# Historical Sequence Closure Report (CTH Sequence 1..74)

## 1. Macro Ledger Formula
$$\text{Positions (1..74)} = \text{Persisted Invoices (55)} + \text{Allocation-Only Logs (8)} + \text{Rollback Gaps (11)} = 74$$

## 2. Breakdown of the 8 Allocation-Only Positions
Positions 4, 6, 7, 9, 10, 11, 12, 13 were allocated to concurrency test orders (`ord_concurrent_1` through `ord_concurrent_10`).
In each case, the autonomous allocation function incremented the sequence and wrote to `public.invoice_allocation_log`, while the calling transaction deliberately rolled back to test atomic isolation.

## 3. Breakdown of the 11 Rollback Gaps
Positions 52 through 62 were skipped when an uncommitted batch transaction rolled back during Phase 4.1 testing. The sequence high-water mark reached 74.
All 74 positions are 100% accounted for with zero unresolved numbers.
