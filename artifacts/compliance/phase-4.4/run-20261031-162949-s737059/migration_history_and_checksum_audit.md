# Migration History and Checksum Audit

## 1. Migration Inventory
1. `c7_10_fix_branch_inventory_fk.sql`
2. `c7_11_fix_corporate_gifting_fk.sql`
3. `c7_12_database_driven_gst_and_invoice_series.sql` (Preserved byte-for-byte; neutralizes synthetic approvals in c7_13)
4. `c7_13_statutory_approval_integrity_and_governance.sql` (Phase 4.3 corrective migration)
5. `c7_14_database_trigger_and_truncate_governance.sql` (Phase 4.4 hardening migration)

All migrations apply forward-only without rewriting git history.