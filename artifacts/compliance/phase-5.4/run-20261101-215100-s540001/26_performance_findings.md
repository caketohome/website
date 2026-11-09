# Phase 5.4 — Performance Findings
**Performance Benchmarks in Rehearsal:**
1. Sequence reservation latency under row-level locking: < 8ms.
2. Table-level MD5 integrity hashing for 127 orders and 71 invoices: < 25ms.
3. Idempotency cache lookup: < 3ms.
4. Concurrency lock contention overhead: negligible under standard checkout load.