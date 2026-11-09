# CAKETOHOME — DEFECT REGISTER AND REMEDIATION LOG
## Remediation of Pre-existing Inconsistencies During Phase 4

| Defect ID | Severity | Component | Description | Remediation Applied | Status |
|---|---|---|---|---|---|
| DEF-01 | HIGH | Database Schema | `auth.users.id` requires UUID format; string test IDs failed | Normalized all test user IDs to valid RFC 4122 UUIDs | RESOLVED |
| DEF-02 | MEDIUM | RBAC Roles | Role ID constraint in `user_role_assignments` required UPPERCASE (`CUSTOMER`) | Updated role assignment queries to match canonical enum values | RESOLVED |
| DEF-03 | MEDIUM | Product Catalog | `product.price` column does not exist; price is stored in `metadata->>'price'` | Updated price resolution queries to extract from `metadata->>'price'` | RESOLVED |
| DEF-04 | HIGH | Payment Transactions | `payment_transaction` table lacks `payment_method` column; uses `gateway_payment_id` and `metadata` | Aligned insert parameters with authoritative table schema | RESOLVED |
| DEF-05 | MEDIUM | Accounting Vouchers | `accounting_voucher.created_by` has NOT NULL constraint | Explicitly populated `created_by = 'finance_service'` | RESOLVED |

**Open Unresolved Critical Defects:** 0
