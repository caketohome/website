# Invoice Numbering & Sequence Safety Report
- Non-Gapless Sequence Truth: Native PostgreSQL sequences are non-gapless under rollback.
- Statutory Gapless Solution: Managed sequence table with row-level locking (`SELECT ... FOR UPDATE`).