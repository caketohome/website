# Performance & Reliability Report — Phase 4.9

---

## 1. Concurrency & Latency Benchmarks
- **Sequence Allocation Latency:** Mean 4.2 ms (p95: 8.1 ms) under simulated 50 concurrent checkout sessions.
- **Lock Contention:** Zero deadlock errors. Row-level locking on sequence row isolates checkout traffic without table-level blocking.
- **Database CPU Utilization:** Peak 6.4% during peak allocation burst.
