# BDR-11 April 1 IST Rollover Procedure — Phase 4.9

---

## 1. Annual Financial Year Rollover Execution
1. At 23:59:50 IST on March 31, system pauses incoming order invoice allocation for 30 seconds.
2. At 00:00:00 IST on April 1, database cron evaluates financial year token:
   - For FY 2026-27: `26-27` transitions to `27-28`.
   - Sequence resets to `1`.
3. An audit record is written to `compliance_invoice_audit_log`.
4. Normal checkout resume.
