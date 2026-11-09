# Sequence Allocation and Concurrency Report
Specifies row-level locking query:
```sql
SELECT current_val, max_val FROM invoice_series_sequence WHERE series_id = 'c2h_2026_main' FOR UPDATE;
```
Ensures strictly monotonic allocation under high concurrency.