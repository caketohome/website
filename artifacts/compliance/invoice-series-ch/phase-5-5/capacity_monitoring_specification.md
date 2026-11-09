# CAPACITY MONITORING SPECIFICATION
**Series:** `CH` | **Fiscal Year:** `2026-27` | **Ceiling:** `9,999,999`  

### Operational Thresholds:
- **Normal Operating Range:** Sequence 1 to 7,999,998 (0% to 79.99%).
- **Warning Threshold (80%):** Alert triggered at sequence **7,999,999**. System alerts Finance Approver and System Administrator.
- **Critical Threshold (95%):** High-priority escalation triggered at sequence **9,499,999**.
- **Hard Statutory Block (100%):** Increments beyond **9,999,999** blocked with `STATUTORY_CAPACITY_EXCEEDED`.
- **Searchable Allocation Log Filters:** Filter by GSTIN, FY, Invoice Number, Order ID, Date Range, Status.