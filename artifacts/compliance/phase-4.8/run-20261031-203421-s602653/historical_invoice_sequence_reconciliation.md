# Historical Invoice Sequence Reconciliation (CTH 1 through 74)

## 1. High-Water Mark Reconciliation
- **Sequence High-Water Mark:** 74
- **Persisted Invoices in `public.invoice`:** 55
- **Allocation Log Entries in `public.invoice_allocation_log`:** 63
- **Unaccounted Positions:** **0** (100% reconciled)

## 2. Mathematical Reconciliation Formula
$$\text{Total Positions (1..74)} = \text{Persisted Invoices (55)} + \text{Allocation-Only Entries (8)} + \text{Rollback Gaps (11)} = 74$$

## 3. Position-by-Position Classification Table

| Sequence Range | Positions | Classification | Details / Cause |
|---|---|---|---|
| **000001 – 000003** | 1, 2, 3 | Persisted & Logged | Invoices `CTH/26-27/000001` to `000003` persisted with allocation logs. |
| **000004** | 4 | Allocation-Only | Allocated to `ord_concurrent_4`; transaction rolled back before invoice write. |
| **000005** | 5 | Persisted & Logged | Invoiced and logged. |
| **000006 – 000007** | 6, 7 | Allocation-Only | Allocated to `ord_concurrent_8` and `ord_concurrent_1`; uncommitted. |
| **000008** | 8 | Persisted & Logged | Invoiced and logged. |
| **000009 – 000013** | 9, 10, 11, 12, 13 | Allocation-Only | Allocated to `ord_concurrent_5, 10, 6, 2, 7`; uncommitted test races. |
| **000014 – 000051** | 14..51 (38 rows) | Persisted & Logged | Invoiced orders committed with matching allocation logs. |
| **000052 – 000062** | 52..62 (11 rows) | Unallocated Gaps | PostgreSQL sequence jumped during bulk transaction rollback during Phase 4.1 testing. |
| **000063 – 000074** | 63..74 (12 rows) | Persisted & Logged | Invoices committed with matching allocation logs. |
