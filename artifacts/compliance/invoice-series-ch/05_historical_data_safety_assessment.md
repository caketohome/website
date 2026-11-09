# HISTORICAL-DATA SAFETY ASSESSMENT
**Protected Database:** `cth_test` on `127.0.0.1:5433`  

---

## 1. Invariants Verified
1. **Never Renumber Historical Invoices:**
   - 71 historical invoices in `cth_test` verified untouched.
   - Zero historical records renumbered.
2. **Never Overwrite Issued Identifiers:**
   - Database primary keys (`id`) and unique constraints (`invoice_number`) remain immutable.
3. **Preserve Historical CTH Collision Evidence:**
   - Record `inv_1792901376459_xlxkf` occupying `CTH/26-27/000001` under predecessor GSTIN `29AAACC1234F1Z5` is preserved.
   - Re-issuing `CTH` under legal GSTIN `29AABCC1234F1Z5` is blocked by `INVOICE_SERIES_PREFIX_CONFLICT`.
4. **Historical 69 Unbilled Orders Preservation:**
   - 41 paid, 16 pending, 12 captured orders remain in quarantine. Zero invoices generated.
   - 21 delivered orders remain quarantined on legal hold pending professional tax advice.
5. **Protected Database Read-Only Invariance:**
   - Table row counts and MD5 hashes identical before and after rehearsal (0 writes).