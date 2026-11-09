# Migration and Release Manifest Verification
**Frozen Commit:** `d231cee7e55f716526e62f5799cc7377c555fed3`  

---

## 1. Migration Verification Table

| Migration File | Size | SHA-256 Digest | Status |
| :--- | :---: | :--- | :---: |
| `c7_10_coverage_configuration.sql` | 5,206 | `7ff887c94bdb36a8f99ef1053085aa555305c14e7b718391c2cb59385668631c` | Intact |
| `c7_11_assignment_schema.sql` | 4,747 | `201eff149a72280a29b1f93312153b4109912b37bf28bbe73fb5e10c3b16201b` | Intact |
| `c7_12_database_driven_gst_and_invoice_series.sql` | 8,048 | `fc695f120853e7030c98b7c49bea6b718ac7c1b7dbec745b01a49576eafbf7bc` | Intact |
| `c7_13_statutory_approval_integrity_and_governance.sql` | 5,798 | `33aeffe3fc402edda3344d6cb754d2a775d33b17fd126c25f15939fa3f46aa29` | Intact |
| `c7_14_database_trigger_and_truncate_governance.sql` | 4,500 | `222c255af1d15856481901efec192d2bf5003bb678c9179634693dfc8b805650` | Intact |

All migrations pass the hardened CI/CD linter (`lint_migrations.cjs --remediated-baseline`).
