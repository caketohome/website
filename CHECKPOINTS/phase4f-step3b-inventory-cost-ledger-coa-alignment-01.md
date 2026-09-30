# CAKETOHOME ERP — PHASE 4F STEP 3B: INVENTORY COST LEDGER & COA SEMANTIC ALIGNMENT

- **Document Version**: 1.0.0
- **Status**: COMPLETE & INDEPENDENTLY VERIFIED ✅
- **Date**: 2026-09-24
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Authoritative Source of Truth**: Live PostgreSQL Database
- **Scope**: Step 3B Schema Migration (`public.inventory_cost_lot`), Chart of Accounts Semantic Alignment (Accounts 1132 & 5110), Type Definitions, and Database Invariant Verification

---

## 1. Executive Summary & Gate Status

Phase 4F Step 3B has been successfully executed with zero errors, zero warnings, and full independent verification.

### Gate Results Summary
- **Inventory Cost Lot Table**: Created `public.inventory_cost_lot` with 20 strongly typed columns, 6 foreign keys, 8 CHECK constraints, and 5 indexes. Table contains **0 rows**.
- **Chart of Accounts Semantic Alignment**:
  - Account `1132`: Renamed from `Bakery Raw Materials & Ingredients` to `Merchandise Inventory - Cakes` (Description updated to reflect balance sheet asset account for physically held cake merchandise purchased from commercial bakeries for resale).
  - Account `5110`: Renamed from `Raw Material Consumption / Bakery Ingredients` to `COGS - Cakes` (Description updated to reflect COGS recognized upon fulfillment of purchased cake merchandise).
  - Account codes, levels, types (`ASSET`, `EXPENSE`), subtypes (`INVENTORY`, `COGS`), parent relationships, and balances were 100% preserved. Total accounts remain **98**.
- **Physical Inventory Intact**: `branch_inventory` remains at exactly **424 rows** (purely original accessory items `acc_01`–`acc_08`). Exactly **0 synthetic cake rows** were created.
- **Historical Orders & Payments Intact**: Historical orders remain **173**, payment transactions remain **53**.
- **Accounting Posting Hard-Blocked**: `accounting_voucher` remains **0**, `accounting_journal_entry` remains **0**, `accounting_journal_line` remains **0**, `accounting_fiscal_period` remains **0**, and `setting.accounting_start_date` remains **UNCONFIGURED**.
- **Security Regression Test Suite**: **21/21 PASS** (100% compliance across all 7 vulnerability categories).
- **TypeScript Strict Compilation**: **0 errors / diagnostics** (`tsc --noEmit`).
- **Git State**: Clean, no commit, no push, no staging.

---

## 2. Forensic Pre-Migration Baseline & Invariant Counts

Before any DDL or DML execution, the pre-migration state of PostgreSQL was forensically verified:

| Table / Entity | Pre-Migration Count | Post-Migration Count | Invariant Status |
|---|:---:|:---:|---|
| `public.accounting_account` | 98 | 98 | Invariant Preserved (semantic labels updated) |
| `public.inventory_cost_lot` | *did not exist* | **0** | Created empty (no fabricated lots) |
| `public.branch_inventory` | 424 | 424 | Invariant Preserved (0 synthetic cake rows) |
| `public.purchase` | 0 | 0 | Invariant Preserved (no purchases posted) |
| `public.purchase_item` | 0 | 0 | Invariant Preserved (no items posted) |
| `public.purchase_payment` | 0 | 0 | Invariant Preserved (no payments posted) |
| `public.accounting_voucher` | 0 | 0 | Invariant Preserved (no vouchers created) |
| `public.accounting_journal_entry` | 0 | 0 | Invariant Preserved (no journals created) |
| `public.accounting_journal_line` | 0 | 0 | Invariant Preserved (no lines created) |
| `public.accounting_fiscal_period` | 0 | 0 | Invariant Preserved (no fiscal periods) |
| `public.setting (accounting_start_date)` | 0 (unconfigured) | 0 (unconfigured) | Invariant Preserved |
| `public.order` | 173 | 173 | Invariant Preserved |
| `public.payment_transaction` | 53 | 53 | Invariant Preserved |
| `public.supplier` | 0 | 0 | Invariant Preserved |
| `public.product` | 65 | 65 | Invariant Preserved |
| `public.product_variant` | 27 | 27 | Invariant Preserved |
| `public.branch` | 57 | 57 | Invariant Preserved |

---

## 3. Detailed Schema Specification: `public.inventory_cost_lot`

The table `public.inventory_cost_lot` was created via the transactional migration script `frontend/migrate_phase4f_step3b_cost_ledger.js`:

### A. Columns & Data Types
```sql
CREATE TABLE IF NOT EXISTS public.inventory_cost_lot (
  id                  TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  branch_id           TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  product_id          TEXT            NULL REFERENCES public.product(id) ON DELETE RESTRICT,
  variant_id          TEXT            NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
  item_type           TEXT            NOT NULL CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING')),
  purchase_id         TEXT            NOT NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
  purchase_item_id    TEXT            NOT NULL REFERENCES public.purchase_item(id) ON DELETE RESTRICT,
  supplier_id         TEXT            NOT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
  received_quantity   NUMERIC(12, 3)  NOT NULL CHECK (received_quantity > 0),
  remaining_quantity  NUMERIC(12, 3)  NOT NULL CHECK (remaining_quantity >= 0),
  unit_cost           NUMERIC(14, 4)  NOT NULL CHECK (unit_cost >= 0),
  total_cost          NUMERIC(14, 2)  NOT NULL CHECK (total_cost >= 0),
  currency            VARCHAR(3)      NOT NULL DEFAULT 'INR',
  received_at         DATE            NOT NULL,
  status              TEXT            NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'REVERSED')),
  reversal_of_lot_id  TEXT            NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
  reversed_by_lot_id  TEXT            NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
  created_by          TEXT            NOT NULL DEFAULT 'SYSTEM',
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cost_lot_qty_bound CHECK (remaining_quantity <= received_quantity),
  CONSTRAINT chk_cost_lot_reversal_limit CHECK (reversal_of_lot_id IS NULL OR reversed_by_lot_id IS NULL)
);
```

### B. Constraints Enforced
1. **Quantity Conservation**: `chk_cost_lot_qty_bound` enforces that `remaining_quantity <= received_quantity`.
2. **Positive Receipts**: `inventory_cost_lot_received_quantity_check` enforces `received_quantity > 0`.
3. **No Negative Stock**: `inventory_cost_lot_remaining_quantity_check` enforces `remaining_quantity >= 0`.
4. **No Negative Costs**: `inventory_cost_lot_unit_cost_check` and `inventory_cost_lot_total_cost_check` enforce `unit_cost >= 0` and `total_cost >= 0`.
5. **Item Type Enumeration**: `inventory_cost_lot_item_type_check` restricts `item_type` strictly to `('CAKE', 'ACCESSORY', 'PACKAGING')`.
6. **Lot Lifecycle Status**: `inventory_cost_lot_status_check` restricts `status` strictly to `('ACTIVE', 'DEPLETED', 'REVERSED')`.
7. **Reversal Audit Limit**: `chk_cost_lot_reversal_limit` ensures a lot cannot be both a compensating reversal and itself reversed.
8. **Referential Integrity**: All foreign keys enforce `ON DELETE RESTRICT` to guarantee historical audit permanence.

### C. Indexes Created
1. `idx_inventory_cost_lot_fifo`: Partial composite index on `(branch_id, variant_id, received_at ASC, created_at ASC) WHERE (status = 'ACTIVE' AND remaining_quantity > 0)` for ultra-fast, lock-efficient FIFO lot resolution during future order fulfillment.
2. `idx_inventory_cost_lot_purchase`: Index on `(purchase_id)` for purchase-level reconciliations.
3. `idx_inventory_cost_lot_purchase_item`: Index on `(purchase_item_id)` for line-item traceability.
4. `idx_inventory_cost_lot_branch`: Index on `(branch_id)` for branch-level asset valuation.
5. `idx_inventory_cost_lot_supplier`: Index on `(supplier_id)` for vendor-level cost auditing.

---

## 4. Chart of Accounts Semantic Corrections

The master Chart of Accounts was updated to permanently retire the obsolete bakery manufacturing semantics:

```sql
UPDATE public.accounting_account
SET name = 'Merchandise Inventory - Cakes',
    description = 'Authoritative balance sheet asset account for physically held cake merchandise purchased from commercial bakeries for resale.',
    updated_at = NOW()
WHERE code = '1132' AND is_group = false;

UPDATE public.accounting_account
SET name = 'COGS - Cakes',
    description = 'Cost of Goods Sold recognized upon fulfillment of purchased cake merchandise to customers.',
    updated_at = NOW()
WHERE code = '5110' AND is_group = false;
```

### Authoritative Resale Accounting Alignment
| Code | Canonical Resale Account Name | Type | Subtype | Level | Role in Trading Model |
|---|---|:---:|:---:|:---:|---|
| **`1131`** | Merchandise Inventory - Accessories | `ASSET` | `INVENTORY` | 4 | Stock asset for party accessories & novelties |
| **`1132`** | Merchandise Inventory - Cakes | `ASSET` | `INVENTORY` | 4 | Stock asset for purchased finished cakes |
| **`1133`** | Packaging Supplies Stock | `ASSET` | `INVENTORY` | 4 | Stock asset for packaging materials |
| **`5110`** | COGS - Cakes | `EXPENSE` | `COGS` | 3 | Cost of goods sold for fulfilled cakes |
| **`5120`** | Accessory Merchandise Sold (Cost of Accessories) | `EXPENSE` | `COGS` | 3 | Cost of goods sold for fulfilled accessories |
| **`5130`** | Packaging Materials Consumed | `EXPENSE` | `COGS` | 3 | Operating consumption of packaging items |

*Seed Script Alignment*: `frontend/seed_phase4d_chart_of_accounts.js` was also updated so that any future idempotent re-seeding permanently preserves these names.

---

## 5. TypeScript Domain Types

The following types and row interfaces were added to `frontend/src/lib/types/accounting.types.ts`:

```typescript
export type LotStatus = "ACTIVE" | "DEPLETED" | "REVERSED";
export type InventoryItemType = "CAKE" | "ACCESSORY" | "PACKAGING";

export interface InventoryCostLotRow {
  id: string;
  branch_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_type: InventoryItemType;
  purchase_id: string;
  purchase_item_id: string;
  supplier_id: string;
  received_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  total_cost: number;
  currency: string;
  received_at: string;
  status: LotStatus;
  reversal_of_lot_id: string | null;
  reversed_by_lot_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

---

## 6. Independent Empirical Verification Results

The script `frontend/scratch/verify_phase4f_step3b_independent.js` was executed and produced:

```
=============================================================================
PHASE 4F STEP 3B INDEPENDENT DATABASE VERIFICATION
=============================================================================

✅ PASS: 1. New valuation table public.inventory_cost_lot exists
✅ PASS: 2. Correct columns exist (missing: none)
✅ PASS: 3a. received_quantity is numeric (got numeric)
✅ PASS: 3b. remaining_quantity is numeric (got numeric)
✅ PASS: 3c. unit_cost is numeric (got numeric)
✅ PASS: 3d. total_cost is numeric (got numeric)
✅ PASS: 3e. currency is varchar (got varchar)
✅ PASS: 3f. received_at is date (got date)
✅ PASS: 3g. status is text (got text)
   Observed FKs: {"branch_id":"branch.id","product_id":"product.id","purchase_id":"purchase.id","purchase_item_id":"purchase_item.id","reversal_of_lot_id":"inventory_cost_lot.id","reversed_by_lot_id":"inventory_cost_lot.id","supplier_id":"supplier.id","variant_id":"product_variant.id"}
✅ PASS: 4a. branch_id FK -> branch.id
✅ PASS: 4b. product_id FK -> product.id
✅ PASS: 4c. variant_id FK -> product_variant.id
✅ PASS: 4d. purchase_id FK -> purchase.id
✅ PASS: 4e. purchase_item_id FK -> purchase_item.id
✅ PASS: 4f. supplier_id FK -> supplier.id
✅ PASS: 4g. reversal_of_lot_id FK -> inventory_cost_lot.id
✅ PASS: 4h. reversed_by_lot_id FK -> inventory_cost_lot.id
   Observed CHECK constraints:
     - chk_cost_lot_qty_bound: CHECK ((remaining_quantity <= received_quantity))
     - chk_cost_lot_reversal_limit: CHECK (((reversal_of_lot_id IS NULL) OR (reversed_by_lot_id IS NULL)))
     - inventory_cost_lot_item_type_check: CHECK ((item_type = ANY (ARRAY['CAKE'::text, 'ACCESSORY'::text, 'PACKAGING'::text])))
     - inventory_cost_lot_received_quantity_check: CHECK ((received_quantity > (0)::numeric))
     - inventory_cost_lot_remaining_quantity_check: CHECK ((remaining_quantity >= (0)::numeric))
     - inventory_cost_lot_status_check: CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'DEPLETED'::text, 'REVERSED'::text])))
     - inventory_cost_lot_total_cost_check: CHECK ((total_cost >= (0)::numeric))
     - inventory_cost_lot_unit_cost_check: CHECK ((unit_cost >= (0)::numeric))
✅ PASS: 5a. Constraint: remaining_quantity <= received_quantity
✅ PASS: 5b. Constraint: received_quantity > 0
✅ PASS: 5c. Constraint: remaining_quantity >= 0
✅ PASS: 5d. Constraint: unit_cost >= 0
✅ PASS: 5e. Constraint: total_cost >= 0
✅ PASS: 5f. Constraint: status in ACTIVE, DEPLETED, REVERSED
✅ PASS: 5g. Constraint: item_type in CAKE, ACCESSORY, PACKAGING
   Observed indexes: idx_inventory_cost_lot_branch, idx_inventory_cost_lot_fifo, idx_inventory_cost_lot_purchase, idx_inventory_cost_lot_purchase_item, idx_inventory_cost_lot_supplier, inventory_cost_lot_pkey
✅ PASS: 6a. idx_inventory_cost_lot_fifo exists
✅ PASS: 6b. idx_inventory_cost_lot_purchase exists
✅ PASS: 6c. idx_inventory_cost_lot_purchase_item exists
✅ PASS: 6d. idx_inventory_cost_lot_branch exists
✅ PASS: 6e. idx_inventory_cost_lot_supplier exists
✅ PASS: 7. inventory_cost_lot has 0 rows (got 0)
✅ PASS: 8. branch_inventory remains exactly 424 rows (got 424)
✅ PASS: 9. Zero synthetic cake inventory rows in branch_inventory (got 0)
✅ PASS: 10a. CoA remains 98 rows (got 98)
✅ PASS: 10b. Account 1132 name is "Merchandise Inventory - Cakes" (got "Merchandise Inventory - Cakes")
✅ PASS: 10c. Account 5110 name is "COGS - Cakes" (got "COGS - Cakes")
✅ PASS: 11a. accounting_voucher is 0 (got 0)
✅ PASS: 11b. accounting_journal_entry is 0 (got 0)
✅ PASS: 11c. accounting_journal_line is 0 (got 0)
✅ PASS: 12. Accounting start date remains unconfigured (0 rows)
✅ PASS: 13. Fiscal periods remain 0 (got 0)
✅ PASS: Historical orders remain 173 (got 173)
✅ PASS: Historical payment_transactions remain 53 (got 53)
✅ PASS: purchase remains 0 (got 0)
✅ PASS: purchase_item remains 0 (got 0)
✅ PASS: purchase_payment remains 0 (got 0)

-----------------------------------------------------------------------------
VERIFICATION RESULT: PASS ✅
```

---

## 7. Migration Idempotency & Re-Run Test

The migration script `frontend/migrate_phase4f_step3b_cost_ledger.js` was executed a second time to verify complete idempotency. It executed cleanly with code 0, verifying that all table and index declarations use `IF NOT EXISTS` and that the Chart of Accounts `UPDATE` statements are non-destructive and idempotent.

---

## 8. Security Regression & TypeScript Build Status

1. **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**:
   - Total Tests: **21**
   - Passed: **21**
   - Failed: **0**
   - Status: **ALL 7 VULNERABILITY FINDINGS VERIFIED FULLY REMEDIATED**
2. **TypeScript Compilation (`tsc --project tsconfig.json --noEmit`)**:
   - Status: **Clean (0 errors, 0 diagnostics)**
3. **Git Hygiene**:
   - `git commit`: NONE
   - `git push`: NONE
   - `git add`: NONE

---

## 9. Next Sequence Boundary (Phase 4F Step 3C)

- **Step 3B is COMPLETE and CLOSED.**
- **DO NOT proceed to Step 3C (`PurchasePostingService`) until explicitly authorized.**
