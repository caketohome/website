# CAKETOHOME — DATABASE INTEGRITY REPORT
## Schema Invariants, Foreign Keys & Check Constraints

### 1. Database Environment Overview
- **Active Testing Database:** `cth_rehearsal_phase4` on port 5433 (50 public & auth tables).
- **Protected Baseline Database:** `cth_test` on port 5433 (39 public tables, 127 orders, 71 invoices, 4 vouchers).
- **Constraint Enforcement:**
  - Foreign key constraints between `order_item` and `product`.
  - Check constraint on `inventory_movement` requiring `quantity > 0`.
  - Not-null constraint on `accounting_voucher.created_by`.
  - UUID primary key on `auth.users` and foreign keys on `user_role_assignments`.
