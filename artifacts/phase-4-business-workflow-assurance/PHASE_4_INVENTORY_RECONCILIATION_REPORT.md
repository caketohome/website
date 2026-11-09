# CAKETOHOME — INVENTORY RECONCILIATION REPORT
## Stock Movements, Dual-Entry Ledger & Integrity

### 1. Inventory Architecture
- **Catalog Mode:** Stock-controlled vs Made-to-order. Stock-controlled items tracked in `public.branch_inventory`.
- **Movement Tracking:** Every inventory change is recorded in `public.inventory_movement` with:
  - `quantity > 0` (enforced by database check constraint `inventory_movement_quantity_check`).
  - `direction` = `'OUT'` for sales and write-offs; `'IN'` for purchases, returns, and adjustments.
- **Overselling Defense:** Stock deductions execute atomically with row-level locks or transactional preconditions.
