# Performance and Observability Report
**Evaluation Focus:** Gate evaluation latency & sequence allocation throughput  

## Performance Metrics
- Gate evaluation query latency: < 12ms.
- Sequence allocation with row lock: < 8ms per transaction.
- Decision register query with 11 items: < 4ms.
- Audit log write overhead: < 3ms.
- No memory leaks or unindexed sequential scans detected.
