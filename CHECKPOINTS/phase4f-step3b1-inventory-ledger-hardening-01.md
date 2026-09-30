# Phase 4F Step 3B.1 Checkpoint: Inventory Ledger & Cost-Lot Architecture Hardening

**Date**: 2026-09-24  
**Status**: PASS  
**Task**: Phase 4F Step 3B.1 — Inventory Ledger + Cost-Lot Hardening  
**Target Milestone**: Resolution of 5 Architecture Blockers before PurchasePostingService (Step 3C)

---

## 1. Executive Summary & Verification Outcome

In Phase 4F Step 3B, initial cost-lot schema creation passed, but the forensic gate identified 5 critical architectural blockers. Phase 4F Step 3B.1 was authorized strictly to resolve these 5 blockers through database and type hardening. No operational posting services (`PurchasePostingService`) were implemented, zero synthetic stock was created, and all baseline invariants remained strictly preserved.

### Overall Gate: **PASS**

All 5 architecture blockers have been resolved:
1. **FIFO Index**: Corrected from `(branch_id, variant_id, received_at, created_at)` to `(branch_id, product_id, variant_id, received_at ASC, created_at ASC)` with partial filter `WHERE status = 'ACTIVE' AND remaining_quantity > 0`.
2. **Inventory Movement & Cost Consumption Ledgers**: Implemented authoritative parent-child ledger architecture (`public.inventory_movement` for physical quantity transactions and `public.inventory_cost_consumption` for multi-lot financial cost allocations) with complete foreign keys and audit metadata.
3. **Reversal Model Resolution**: Redundant self-referencing reversal columns (`reversal_of_lot_id`, `reversed_by_lot_id`) eliminated from `public.inventory_cost_lot`. Reversals are modeled through the accounting voucher reversal linkage and movement ledger (`INVOICE_REVERSAL`), while partial returns consume from the lot through `PURCHASE_RETURN`. Added `UNIQUE (purchase_item_id)` to guarantee 1:1 original lot acquisition idempotency.
4. **Authoritative Merchandise Classification**: Added structured, non-null column `merchandise_type VARCHAR(20) NOT NULL CHECK (merchandise_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'))` to `public.product` (populated: 8 ACCESSORY for `acc_01`..`acc_08`, 57 CAKE for all cakes/cupcakes/pastries, 0 PACKAGING storefront products). Added `item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'))` to `public.purchase_item`.
5. **Cost Consistency Enforcement**: Added check constraint `chk_cost_lot_cost_consistency CHECK (ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05)` on `public.inventory_cost_lot`. Total cost is the authoritative balance sheet debit; unit cost is the 4-decimal derived rate. Mathematically inconsistent lot insertions are rejected by PostgreSQL.

---

## 2. Forensic Resolution of the 5 Blockers

### Blocker 1: FIFO Index Product Isolation
- **Previous State**: Index `idx_inventory_cost_lot_fifo` was defined as `(branch_id, variant_id, received_at, created_at)`. When `variant_id IS NULL`, distinct products at the same branch shared identical index keys, allowing non-variant products to cross-consume FIFO queues.
- **Hardened State**:
  ```sql
  DROP INDEX IF EXISTS public.idx_inventory_cost_lot_fifo;
  CREATE INDEX idx_inventory_cost_lot_fifo 
  ON public.inventory_cost_lot (branch_id, product_id, variant_id, received_at ASC, created_at ASC)
  WHERE (status = 'ACTIVE' AND remaining_quantity > 0);
  ```
- **Verification**: Verified via `pg_indexes` that the partial index covers `(branch_id, product_id, variant_id, received_at, created_at)` with `status = 'ACTIVE'` and `remaining_quantity > 0`.

### Blocker 2: Movement & Cost Consumption Ledgers
- **Problem**: Physical stock movements (sales, receipts, returns, adjustments, transfers) can consume across multiple cost lots under FIFO (e.g., a 10-unit sale consuming 6 units @ ₹100 and 4 units @ ₹110). Storing movement in a single flat row either loses multi-lot traceability or violates normal form.
- **Architectural Solution**: **Parent-Child Ledger Model**:
  1. **Physical Movement Header (`public.inventory_movement`)**:
     - Columns: `id` (PK), `branch_id` (FK), `product_id` (FK nullable for packaging), `variant_id` (FK nullable), `movement_type` (`PURCHASE_RECEIPT`, `SALES_FULFILLMENT`, `PURCHASE_RETURN`, `SALES_RETURN`, `STOCK_ADJUSTMENT_UP`, `STOCK_ADJUSTMENT_DOWN`, `TRANSFER_IN`, `TRANSFER_OUT`, `DAMAGE_WRITEOFF`, `INVOICE_REVERSAL`), `quantity` (> 0), `direction` (`IN`, `OUT`), `order_id` (FK nullable), `purchase_id` (FK nullable), `voucher_id` (FK nullable), `reference_no`, `narration`, `created_by`, `created_at`.
  2. **Cost Allocation Child (`public.inventory_cost_consumption`)**:
     - Columns: `id` (PK), `movement_id` (FK `inventory_movement.id`), `lot_id` (FK `inventory_cost_lot.id`), `quantity` (> 0), `unit_cost` (>= 0), `total_cost` (>= 0), `created_at`.
     - Math Check: `CHECK (ABS(total_cost - ROUND(quantity * unit_cost, 2)) <= 0.05)`.
- **Traceability**: Every quantity change links physical direction, actor, timestamp, source transaction (`order_id`, `purchase_id`), accounting voucher (`voucher_id`), and exact cost-lot consumption allocations (`lot_id`, `unit_cost`, `total_cost`).

### Blocker 3: Lot Reversal Model Resolution
- **Problem**: `inventory_cost_lot` had `reversal_of_lot_id` and `reversed_by_lot_id` foreign keys, implying reversals create new lots, which contradicted the ERP principle that purchase reversals and purchase returns do not create new acquisition lots.
- **Architectural Solution**:
  - Dropped `reversal_of_lot_id`, `reversed_by_lot_id`, and `chk_cost_lot_reversal_limit` from `public.inventory_cost_lot`.
  - Reversals are modeled at the accounting level via `voucher.reversed_by_voucher_id` and at the inventory movement level via `movement_type = 'INVOICE_REVERSAL'`. The original lot transitions to `status = 'REVERSED'` and `remaining_quantity = 0`.
  - Partial returns consume quantity from the lot via `movement_type = 'PURCHASE_RETURN'`.
  - Added `CONSTRAINT uq_inventory_cost_lot_purchase_item UNIQUE (purchase_item_id)` guaranteeing 1:1 original lot acquisition idempotency.

### Blocker 4: Authoritative Merchandise Classification
- **Problem**: Product classification relied on informal heuristics (e.g. `product.id LIKE 'acc_%'`), with no authoritative column on `public.product` or `public.purchase_item`.
- **Hardened State**:
  - Added `merchandise_type VARCHAR(20) NOT NULL CHECK (merchandise_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'))` to `public.product`.
  - Populated based on verified catalog:
    - 8 products (`acc_01`..`acc_08`) set to `'ACCESSORY'`.
    - 57 products (cakes, pastries, cupcakes) set to `'CAKE'`.
    - 0 storefront products set to `'PACKAGING'`.
  - Added `item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'))` to `public.purchase_item`.
  - Packaging items (boxes, cake boards, ribbons) purchased for operations without a storefront catalog item will have `product_id IS NULL`, `item_type = 'PACKAGING'`, mapping directly to Account 1133 (Merchandise Inventory - Packaging).

### Blocker 5: Cost Consistency Enforcement
- **Problem**: `public.inventory_cost_lot` permitted mathematically inconsistent combinations (e.g., `qty = 10, unit_cost = 100, total_cost = 500`).
- **Hardened State**:
  - Enforced in DB:
    ```sql
    ALTER TABLE public.inventory_cost_lot 
    ADD CONSTRAINT chk_cost_lot_cost_consistency CHECK (
      ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05
    );
    ```
  - Total cost is authoritative (matching GL debit amount). Unit cost is derived as `ROUND(total_cost / received_quantity, 4)`.
  - Verified that PostgreSQL rejects inconsistent test insertions (tested and rolled back in independent test suite).

---

## 3. Live Database Baseline Invariants Verification

All 14 operational and baseline tables were independently audited post-migration:

| Table | Pre-Migration Count | Post-Migration Count | Status |
| :--- | :--- | :--- | :--- |
| `public.accounting_account` | 98 | 98 | PRESERVED |
| `public.accounting_voucher` | 0 | 0 | PRESERVED |
| `public.accounting_journal_entry` | 0 | 0 | PRESERVED |
| `public.accounting_journal_line` | 0 | 0 | PRESERVED |
| `public.accounting_fiscal_period` | 0 | 0 | PRESERVED |
| `public.purchase` | 0 | 0 | PRESERVED |
| `public.purchase_item` | 0 | 0 | PRESERVED |
| `public.purchase_payment` | 0 | 0 | PRESERVED |
| `public.branch_inventory` | 424 | 424 | PRESERVED |
| `public."order"` | 173 | 173 | PRESERVED |
| `public.payment_transaction` | 53 | 53 | PRESERVED |
| `public.inventory_cost_lot` | 0 | 0 | PRESERVED |
| `public.inventory_movement` | — (new) | 0 | CLEAN |
| `public.inventory_cost_consumption` | — (new) | 0 | CLEAN |
| `setting.accounting_start_date` | UNCONFIGURED | UNCONFIGURED | PRESERVED |

---

## 4. Security & TypeScript Verification

1. **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**:
   - Total Tests: 21
   - Passed: 21
   - Failed: 0
   - Verified: Fail-closed auth, timingSafeEqual JWT validation, forged role rejection, strict admin identity check, BOLA/IDOR protection on orders and profile, environment-only DB secrets, SSRF protection against loopback/metadata.
2. **TypeScript Compilation (`tsc --project tsconfig.json --noEmit`)**:
   - Result: 0 errors. Clean compilation across all types and modules.
3. **TypeScript Types Updated**:
   - `frontend/src/lib/types/accounting.types.ts`: Removed `reversal_of_lot_id`/`reversed_by_lot_id`, added `MerchandiseType`, `InventoryMovementType`, `InventoryMovementDirection`, `InventoryMovementRow`, `InventoryCostConsumptionRow`.
   - `frontend/src/lib/types/domain.ts`: Added `merchandise_type?: "CAKE" | "ACCESSORY" | "PACKAGING";` to `ProductDomain`.
   - `frontend/src/lib/types/purchase.types.ts`: Added `item_type: "CAKE" | "ACCESSORY" | "PACKAGING";` to `PurchaseItemRow` and `item_type?: ...` to `PurchaseItemInput`.

---

## 5. Git State Audit

- **Branch**: `task/devNew`
- **Git Commit**: NONE (per non-negotiable rules)
- **Git Push**: NONE
- **Git Staging**: NONE
- **Last 3 Commits**:
  - `f7d9a47 fix(checkout): resolve react child object render error, order confirmation address formatting & checkout location ui readability`
  - `3081621 merge: integrate task/devNew (new luxury storefront UI) into task/dev`
  - `9ed3975 chore(frontend): update package-lock for framer-motion`

---

## 6. Next Steps & Prerequisites for Step 3C

With all 5 schema and architectural blockers genuinely resolved:
1. `inventory_cost_lot` is hardened with proper FIFO index isolation, cost consistency checks, and unique purchase item idempotency.
2. `inventory_movement` and `inventory_cost_consumption` are established as the canonical dual-ledger movement and cost allocation mechanism.
3. `merchandise_type` and `item_type` provide the authoritative metadata needed by `PurchasePostingService` to route debits to Cake (1132), Accessory (1131), or Packaging (1133).
4. Step 3C (`PurchasePostingService`) is now unblocked for implementation in the next phase.
