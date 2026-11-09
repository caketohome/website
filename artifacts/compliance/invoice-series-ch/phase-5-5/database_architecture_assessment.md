# DATABASE ARCHITECTURE ASSESSMENT
**Database:** PostgreSQL 16.14  
**Stored Procedure:** `public.allocate_invoice_number`  

### Key Architectural Remediations:
1. **LPAD Truncation Flaw Remediation:**
   - Previous implementation used `LPAD(v_seq::text, 6, '0')`, which truncates `1000000` to `100000` (duplicate sequence collision).
   - Remediated with dynamic conditional formatting:
     `IF v_seq <= 999999 THEN LPAD(v_seq::text, 6, '0') ELSE v_seq::text END IF;`.
2. **Transactional vs Native Sequences:**
   - Native sequences (`CREATE SEQUENCE`) cache values and cannot guarantee gapless numbering upon transaction rollback.
   - Statutory compliance is enforced via transactional table `public.invoice_sequence` with row-level locks and `pg_advisory_xact_lock`.
3. **Multi-GSTIN & Entity Isolation:**
   - Unique constraint `uq_invoice_sequence_entity_gstin_fy_prefix` on `(entity_id, gstin, fiscal_year, prefix)` guarantees no cross-registration contamination.