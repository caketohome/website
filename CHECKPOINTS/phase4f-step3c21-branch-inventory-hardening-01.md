# Phase 4F Step 3C.2.1 — Branch Inventory Hardening & Catalog RBAC Design Validation

**Checkpoint Identifier**: `CHECKPOINTS/phase4f-step3c21-branch-inventory-hardening-01.md`  
**Execution Timestamp**: 2026-09-24 17:10:00 IST  
**Git Branch**: `task/dev`  
**Head Commit**: `f7d9a47` (no new commits)  
**Status**: **PASS — PHYSICAL INVENTORY HARDENED + RBAC BOUNDARY FORMALIZED**  

---

## 1. Executive Summary

In accordance with the scope authorized following Step 3C.2, **Phase 4F Step 3C.2.1** has executed two critical prerequisites before packaging master data creation:

1. **Forensic Validation & Database Hardening of `public.branch_inventory`**:
   - Comprehensive audit of all 424 existing rows confirmed zero orphan product references, zero orphan variant references, 100% internal product-to-variant consistency, zero negative quantities, and zero negative reserved quantities.
   - Executed transactional migration [`frontend/migrate_phase4f_step3c21_hardening.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase4f_step3c21_hardening.js) adding two foreign key constraints (`product_id` and `variant_id` with `ON DELETE RESTRICT`) and two check constraints (`quantity >= 0` and `reserved >= 0`).
   - Verified active enforcement through an independent test suite ([`frontend/scratch/verify_phase4f_step3c21_independent.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/verify_phase4f_step3c21_independent.js)), proving that negative stock, invalid foreign keys, and hard-deletion of catalog items with active stock are strictly rejected by the PostgreSQL engine.
   - Script re-run confirmed 100% idempotency.

2. **Catalog & Packaging Master-Data RBAC Design Validation**:
   - Analyzed existing permissions in `staff-access-control.ts`. Found that while `PRODUCTS.CREATE` and `PRODUCTS.EDIT` exist in the canonical catalog definition, they are currently unassigned to any operational staff profile and unenforced in API routes.
   - Formulated strict Segregation of Duties (SoD) boundaries: branch managers and procurement staff are strictly prohibited from creating or modifying master-data items, SKUs, HSN codes, or tax classes. Master-data governance is strictly isolated to central administrator roles (`SUPER_ADMIN` or dedicated `Central Catalog Operations`).

3. **Invariants Preserved**:
   - Zero packaging products created (intentionally deferred).
   - Live database baseline verified intact (424 branch inventory rows, 173 orders, 53 payments, 98 accounts, 0 accounting transactions, 0 cost lots, 0 inventory movements).
   - Security regression suite: **21/21 PASS**.
   - TypeScript compilation: **0 errors**.
   - Zero Git commits or pushes.

---

## 2. Pre-Migration Forensic Audit of `public.branch_inventory`

Before executing any DDL statements, a read-only forensic script ([`frontend/scratch/forensic_step3c21_branch_inventory.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/forensic_step3c21_branch_inventory.js)) inspected every row of the live inventory table.

### A. Row Counts & Data Integrity
| Metric | Value | Analysis |
|---|---|---|
| Total rows | 424 | Exact baseline matching frozen state |
| Rows with `product_id IS NULL` | **0** | Strict NOT NULL column |
| Rows with `variant_id IS NULL` | **0** | Strict NOT NULL column |
| Rows with `branch_id IS NULL` | **0** | Strict NOT NULL column |
| Rows with `quantity < 0` | **0** | No negative physical stock exists |
| Rows with `reserved < 0` | **0** | No negative reservations exist |
| Rows with `quantity < reserved` | **0** | Available stock is always non-negative |
| Minimum quantity | 0 | Clean lower bound |
| Maximum quantity | 120 | Legitimate stock range |
| Minimum / Maximum reserved | 0 / 0 | No active locked reservations |

### B. Referential Integrity Analysis
All 424 rows map to exactly 8 accessory products across 53 branches (8 × 53 = 424 rows):

| Product ID | Variant ID | Product Title | Merchandise Type | Product `deleted_at` | Variant `deleted_at` | Rows |
|---|---|---|---|---|---|---|
| `acc_01` | `var_acc_01` | Gold Acrylic Happy Birthday Topper | ACCESSORY | `NULL` (Active) | `NULL` (Active) | 53 |
| `acc_02` | `var_acc_02` | Magic Re-Lighting Birthday Candles (Pack of 10) | ACCESSORY | `NULL` (Active) | `NULL` (Active) | 53 |
| `acc_03` | `var_acc_03` | Custom Handwritten Greeting Card | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |
| `acc_04` | `var_acc_04` | Fresh Bouquet of 10 Red Roses | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |
| `acc_05` | `var_acc_05` | Soft Plush Brown Teddy Bear (8-Inch) | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |
| `acc_06` | `var_acc_06` | Ferrero Rocher Chocolate Box (16 Pieces) | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |
| `acc_07` | `var_acc_07` | Helium Foil Metallic Balloon Bouquet (Bunch of 5) | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |
| `acc_08` | `var_acc_08` | Royal Celebration Luxury Gift Basket | ACCESSORY | 2026-09-19 (Soft-deleted) | `NULL` (Active) | 53 |

**Critical Findings**:
1. **Zero Orphan Rows**: 100% of `branch_inventory.product_id` exist in `public.product`, and 100% of `branch_inventory.variant_id` exist in `public.product_variant`.
2. **100% Relational Alignment**: In all 424 rows, `variant.product_id` matches `branch_inventory.product_id` with zero mismatches.
3. **Soft-Deleted Product Compatibility**: 6 of the 8 accessory products have `deleted_at IS NOT NULL`. In PostgreSQL, foreign keys validate against the primary key table row existence regardless of `deleted_at`. Foreign keys can therefore be applied safely without data loss or soft-delete incompatibility.
4. **Deletion Semantics**: To prevent accidental hard deletion of products or variants that have physical stock or audit history, foreign keys must specify `ON DELETE RESTRICT` (matching the convention in `inventory_cost_lot` and `inventory_movement`).

### C. Quantity & Reservation Semantics in Application Code
Code inspection across `InventoryService` and `OrderService` confirmed:
- `deductStockAtomic`: uses `WHERE ... AND (quantity - reserved) >= $1` and `quantity = quantity - $1`, ensuring quantity never drops below reserved or zero.
- `reserveStock`: uses `WHERE ... AND (quantity - reserved) >= $1` and `reserved = reserved + $1`.
- `releaseReservation`: uses `SET reserved = GREATEST(0, reserved - $1)`.
- `setStock`: enforces `Math.max(0, quantity)`.
- **Verdict**: Database check constraints `quantity >= 0` and `reserved >= 0` perfectly match application logic and provide essential defense-in-depth against race conditions or data corruption.

---

## 3. Migration Implementation (`migrate_phase4f_step3c21_hardening.js`)

The migration script was executed inside a single ACID transaction (`BEGIN ... COMMIT`) with pre-assertion guards:

```sql
-- 1. Foreign Key: branch_inventory.product_id -> product(id)
ALTER TABLE public.branch_inventory
  ADD CONSTRAINT branch_inventory_product_id_foreign
  FOREIGN KEY (product_id) REFERENCES public.product(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 2. Foreign Key: branch_inventory.variant_id -> product_variant(id)
ALTER TABLE public.branch_inventory
  ADD CONSTRAINT branch_inventory_variant_id_foreign
  FOREIGN KEY (variant_id) REFERENCES public.product_variant(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 3. Check Constraint: quantity >= 0
ALTER TABLE public.branch_inventory
  ADD CONSTRAINT branch_inventory_quantity_non_negative
  CHECK (quantity >= 0);

-- 4. Check Constraint: reserved >= 0
ALTER TABLE public.branch_inventory
  ADD CONSTRAINT branch_inventory_reserved_non_negative
  CHECK (reserved >= 0);
```

### Active Constraints on `public.branch_inventory` (Post-Migration)
```
┌─────────┬──────────────────────────────────────────┬─────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ conname                                  │ contype │ def                                                                                            │
├─────────┼──────────────────────────────────────────┼─────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'branch_inventory_branch_id_foreign'     │ 'f'     │ 'FOREIGN KEY (branch_id) REFERENCES branch(id) ON UPDATE CASCADE ON DELETE CASCADE'            │
│ 1       │ 'branch_inventory_pkey'                  │ 'p'     │ 'PRIMARY KEY (id)'                                                                             │
│ 2       │ 'branch_inventory_product_id_foreign'    │ 'f'     │ 'FOREIGN KEY (product_id) REFERENCES product(id) ON UPDATE CASCADE ON DELETE RESTRICT'         │
│ 3       │ 'branch_inventory_quantity_non_negative' │ 'c'     │ 'CHECK ((quantity >= 0))'                                                                      │
│ 4       │ 'branch_inventory_reserved_non_negative' │ 'c'     │ 'CHECK ((reserved >= 0))'                                                                      │
│ 5       │ 'branch_inventory_variant_id_foreign'    │ 'f'     │ 'FOREIGN KEY (variant_id) REFERENCES product_variant(id) ON UPDATE CASCADE ON DELETE RESTRICT' │
└─────────┴──────────────────────────────────────────┴─────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Independent Verification & Constraint Testing

An independent verification suite ([`frontend/scratch/verify_phase4f_step3c21_independent.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/verify_phase4f_step3c21_independent.js)) tested all edge cases using atomic rollback transactions:

| Test Case | Attempted Operation | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **Negative Quantity** | `INSERT quantity = -5` | Reject with `branch_inventory_quantity_non_negative` | `violates check constraint "branch_inventory_quantity_non_negative"` | ✅ PASS |
| **Negative Reserved** | `INSERT reserved = -2` | Reject with `branch_inventory_reserved_non_negative` | `violates check constraint "branch_inventory_reserved_non_negative"` | ✅ PASS |
| **Orphan Product** | `INSERT product_id = 'nonexistent'` | Reject with `branch_inventory_product_id_foreign` | `violates foreign key constraint "branch_inventory_product_id_foreign"` | ✅ PASS |
| **Orphan Variant** | `INSERT variant_id = 'nonexistent'` | Reject with `branch_inventory_variant_id_foreign` | `violates foreign key constraint "branch_inventory_variant_id_foreign"` | ✅ PASS |
| **Product Protection** | `DELETE FROM product WHERE id = 'acc_02'` | Reject with `branch_inventory_product_id_foreign` | `violates foreign key constraint "branch_inventory_product_id_foreign"` | ✅ PASS |
| **Variant Protection** | `DELETE FROM product_variant WHERE id = 'var_acc_02'` | Reject with `branch_inventory_variant_id_foreign` | `violates foreign key constraint "branch_inventory_variant_id_foreign"` | ✅ PASS |
| **Idempotency** | Re-run `migrate_phase4f_step3c21_hardening.js` | Zero errors, duplicate guards prevent failure | Script completed with 0 errors | ✅ PASS |
| **Baseline Safety** | Row count assertion across 12 tables | Zero mutations to historical data | 424 inventory, 173 orders, 53 payments, 98 accounts | ✅ PASS |

---

## 5. Catalog & Master-Data RBAC Design Validation

### A. Forensic Analysis of Existing Access Control
Inspection of [`frontend/src/lib/staff-access-control.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts) revealed:
1. `PERMISSION_CATALOG` defines:
   - `PRODUCTS.VIEW` ("View Cake Catalog")
   - `PRODUCTS.CREATE` ("Create Products")
   - `PRODUCTS.EDIT` ("Edit Product Details")
   - `INVENTORY.VIEW` ("View Branch Stock")
   - `INVENTORY.EDIT` ("Update Stock Levels")
2. **Current Profile Mapping**:
   - `Branch Operations` (`prof_branch_ops`) is assigned only `INVENTORY.VIEW` and `INVENTORY.EDIT`. It has **no product creation rights**.
   - `Content Manager` (`prof_content_manager`) has only `PRODUCTS.VIEW` (read-only catalog).
   - Neither `PRODUCTS.CREATE` nor `PRODUCTS.EDIT` is assigned to any active staff profile.
3. **Current Enforcement Gap**:
   - `PRODUCTS.CREATE` is never checked in server actions or route handlers.
   - Any staff member who bypasses the UI could theoretically invoke product creation if the backend endpoint fails to verify permissions.

### B. Segregation of Duties (SoD) Specification for Master Data

The accounting and inventory engines treat the packaging product master as the **authoritative source of truth** for:
- Item identity & merchandise classification (`merchandise_type = 'PACKAGING'`)
- Tax and regulatory classification (`HSN 48191000`, GST 12% / 18%)
- Standard Unit Quantity Code (`UQC = 'NOS'`)
- Stock availability and replenishment tracking
- Cost-lot layer valuation and FIFO consumption
- General ledger balance allocation (DR 1133 Packaging Supplies Stock, DR 5130 Packaging Materials Consumed)

Therefore, master data authorization must be strictly partitioned:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SEGREGATION OF DUTIES (SoD)                           │
├─────────────────────────┬──────────────────────┬────────────────────────────┤
│ Operational Domain      │ Authorized Role      │ Explicit Restrictions      │
├─────────────────────────┼──────────────────────┼────────────────────────────┤
│ Physical Stock Adjust   │ BRANCH_MANAGER       │ CANNOT create master items │
│ (INVENTORY.EDIT)        │ (Local Branch Only)  │ CANNOT change HSN/Tax rates│
├─────────────────────────┼──────────────────────┼────────────────────────────┤
│ Purchase Invoice Entry  │ PROCUREMENT / STAFF  │ CANNOT create master items │
│ (PURCHASE.CREATE)       │ (Authorized Branch)  │ Must match existing SKUs   │
├─────────────────────────┼──────────────────────┼────────────────────────────┤
│ Purchase Approval       │ SUPER_ADMIN          │ CANNOT post vouchers       │
│ (PURCHASE.APPROVE)      │                      │                            │
├─────────────────────────┼──────────────────────┼────────────────────────────┤
│ Accounting Voucher Post │ ACCOUNTANT           │ CANNOT approve purchases   │
│ (ACCOUNTING.POST)       │                      │                            │
├─────────────────────────┼──────────────────────┼────────────────────────────┤
│ Master Data Governance  │ SUPER_ADMIN /        │ Sole authority to create   │
│ (MASTER_DATA.MANAGE /   │ CENTRAL CATALOG OPS  │ packaging products, SKUs,  │
│  PRODUCTS.CREATE)       │                      │ HSN codes & GST classes    │
└─────────────────────────┴──────────────────────┴────────────────────────────┘
```

### C. Proposed Explicit RBAC Guard for Future Master Data API
When the packaging product master API/action is implemented, it must enforce:

```typescript
// Canonical guard for master data creation/modification
const userCtx = await resolveServerSession(req);
if (!userCtx || !userCtx.userId) {
  return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
}

// Strict check: Only SUPER_ADMIN or staff with explicit PRODUCTS.CREATE permission
const isSuperAdmin = userCtx.role === "SUPER_ADMIN" && userCtx.userId === CANONICAL_SUPER_ADMIN_ID;
const hasCatalogPerm = hasEffectivePermission(userCtx.userId, "PRODUCTS.CREATE");

if (!isSuperAdmin && !hasCatalogPerm) {
  return NextResponse.json({ 
    success: false, 
    error: "FORBIDDEN: Master data creation requires CENTRAL_CATALOG authority" 
  }, { status: 403 });
}
```

---

## 6. Baseline Verification Matrix

| Table / Invariant | Baseline (Pre-3C.2.1) | Current (Post-3C.2.1) | Status |
|---|---|---|---|
| `public.product` | 65 | 65 | Unchanged ✅ |
| `public.product_variant` | 27 | 27 | Unchanged ✅ |
| `public.branch_inventory` | 424 | 424 | Hardened with 4 constraints ✅ |
| `public.order` | 173 | 173 | Unchanged ✅ |
| `public.payment_transaction` | 53 | 53 | Unchanged ✅ |
| `public.accounting_account` | 98 | 98 | Unchanged ✅ |
| `public.accounting_voucher` | 0 | 0 | Unchanged ✅ |
| `public.accounting_journal_entry` | 0 | 0 | Unchanged ✅ |
| `public.accounting_fiscal_period` | 0 | 0 | Unchanged ✅ |
| `public.purchase` | 0 | 0 | Unchanged ✅ |
| `public.purchase_item` | 0 | 0 | Unchanged ✅ |
| `public.inventory_cost_lot` | 0 | 0 | Unchanged ✅ |
| `public.inventory_movement` | 0 | 0 | Unchanged ✅ |
| `public.inventory_cost_consumption` | 0 | 0 | Unchanged ✅ |
| `accounting_start_date` setting | UNCONFIGURED | UNCONFIGURED | Unchanged ✅ |
| **Security Suite** | 21/21 PASS | **21/21 PASS** | Tested via `scratch/run_security_regression.js` ✅ |
| **TypeScript Compilation** | 0 errors | **0 errors** | `npx tsc --noEmit` exited clean ✅ |
| **Git Working Tree** | Clean | **Head `f7d9a47`, 0 new commits, 0 pushes** ✅ |

---

## 7. Gate Result & Next Steps

**PHASE 4F STEP 3C.2.1: PASS ✅**

- `public.branch_inventory` is now fully referentially sound and protected against orphan products, orphan variants, negative stock, and negative reservations.
- Application code logic for stock reservation, deduction, and restoration is 100% compliant with the new constraints.
- The catalog master-data authorization boundary is formally defined with strict Segregation of Duties.
- Zero packaging products or mock data have been inserted.

**Recommended Next Step**:
Now that physical inventory is referentially hardened and authorization boundaries are established, proceed to:
👉 **Phase 4F Step 3C.3: Controlled Packaging Master-Data Seeding & Service Layer Integration**  
*(Defining real business packaging products e.g., "1 Kg Cake Box", initializing branch inventory rows, and verifying end-to-end purchase posting with physical quantity updates).*
