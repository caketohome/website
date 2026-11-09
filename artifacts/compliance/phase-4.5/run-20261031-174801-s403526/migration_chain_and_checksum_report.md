# Migration Chain and Checksum Report
**Migration Directory:** `frontend/src/lib/migrations`  
**Chain Sequence:** `c7_12 -> c7_13 -> c7_14`  

---

## 1. Cryptographic Checksum Table

| Migration ID | File Name | Size (Bytes) | SHA-256 Checksum | Execution Status |
| :--- | :--- | :--- | :--- | :--- |
| **c7_10** | `c7_10_coverage_configuration.sql` | 5,206 | `7ff887c94bdb36a8f99ef1053085aa555305c14e7b718391c2cb59385668631c` | Prerequisite Independent |
| **c7_11** | `c7_11_assignment_schema.sql` | 4,747 | `201eff149a72280a29b1f93312153b4109912b37bf28bbe73fb5e10c3b16201b` | Prerequisite Independent |
| **c7_12** | `c7_12_database_driven_gst_and_invoice_series.sql` | 8,048 | `fc695f120853e7030c98b7c49bea6b718ac7c1b7dbec745b01a49576eafbf7bc` | Applied Forward-Only |
| **c7_13** | `c7_13_statutory_approval_integrity_and_governance.sql` | 5,798 | `33aeffe3fc402edda3344d6cb754d2a775d33b17fd126c25f15939fa3f46aa29` | Applied Forward-Only |
| **c7_14** | `c7_14_database_trigger_and_truncate_governance.sql` | 4,500 | `222c255af1d15856481901efec192d2bf5003bb678c9179634693dfc8b805650` | Applied Forward-Only |

## 2. Dependency & Forward-Only Flow
1. `c7_12`: Establishes `company_id` and `gst_registration_id` on `public.branch`; adds statutory columns to `invoice_sequence`; defines `public.allocate_invoice_number` stored procedure.
2. `c7_13`: Neutralizes synthetic approval tokens in `invoice_sequence` (`REVOKED_SYNTHETIC`); establishes `invoice_series_approval_audit` immutable log; creates initial triggers.
3. `c7_14`: Expands sequence trigger to `BEFORE INSERT OR UPDATE` to block direct series creation in `APPROVED` status; adds statement-level `BEFORE TRUNCATE` trigger; marks all triggers `ENABLE ALWAYS`.
