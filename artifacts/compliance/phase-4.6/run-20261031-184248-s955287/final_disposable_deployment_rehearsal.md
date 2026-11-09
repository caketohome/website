# Final Disposable Deployment Rehearsal Report
**Target Database:** `cth_rehearsal_phase4_6` on `127.0.0.1:5433`  
**Template Source:** `cth_test`  

---

## 1. Rehearsal Execution Log
1. Provisioned isolated ephemeral database `cth_rehearsal_phase4_6`.
2. Applied frozen migrations:
   - `c7_12_database_driven_gst_and_invoice_series.sql`: SUCCESS
   - `c7_13_statutory_approval_integrity_and_governance.sql`: SUCCESS
   - `c7_14_database_trigger_and_truncate_governance.sql`: SUCCESS
3. Verified `pg_trigger` catalog: 3 triggers registered as `tgenabled = 'A'` (`ENABLE ALWAYS`).
4. Verified Fail-Closed Allocation: Allocation attempt without approved series rejected with `UNAUTHORIZED_INVOICE_SERIES`.
