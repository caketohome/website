# HISTORICAL STAGING SERIES DISPOSITION PROPOSAL (BDR-06)
**Target Data:** 13 synthetic/test invoice records in `public.invoice` (12 `CONC` + 1 `SAFE-TEST`).  

## Proposal
- Maintain records in `public.invoice` to guarantee relational integrity.
- Mark series in `public.invoice_sequence` as `DEPRECATED_HISTORICAL`.
- Exclude from public customer download endpoints.
- Zero modifications or deletions to historical ledger.
