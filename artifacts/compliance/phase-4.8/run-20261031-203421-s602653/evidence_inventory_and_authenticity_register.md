# Evidence Inventory and Authenticity Register

This register inventories all primary evidence artifacts evaluated during Phase 4.8, recording their origin, cryptographic SHA-256 integrity, and authenticity status.

| Item ID | Description | Source / Location | Hash / Status | Authenticity |
|---|---|---|---|---|
| EVD-001 | Protected Database Baseline (`cth_test`) | `127.0.0.1:5433/cth_test` | `Orders: 34d74cd0... / Inv: eb27d8ec...` | Primary Ground Truth |
| EVD-002 | Board Submission Document | `board_submission_invoice_series_designation.md` | Ref: `CTH-GOV-2026-SUB-01` | Proposed Draft (Unadopted) |
| EVD-003 | Disposable Rehearsal Database | `127.0.0.1:5433/cth_rehearsal_phase4_8` | Cloned from `cth_test` template | Active Rehearsal |
| EVD-004 | Historical Invoice Sequence Data | `public.invoice` (55 CTH rows) | High-water mark 74 | Reconciled Ground Truth |
| EVD-005 | Allocation Event Logs | `public.invoice_allocation_log` (63 rows) | Positions 1..51, 63..74 | Reconciled Ground Truth |
| EVD-006 | Order Repository Data | `public.order` (127 rows) | 58 invoiced, 69 unbilled | Reconciled Ground Truth |
| EVD-007 | Synthetic Invoice Manifest | `public.invoice` (15 rows) | 14 CONC, 1 SAFE-TEST | Isolated Test Data |
| EVD-008 | Migration Chain (`c7_10` to `c7_14`) | `frontend/src/lib/migrations/` | 5 migration files | Verified Canonical Code |
