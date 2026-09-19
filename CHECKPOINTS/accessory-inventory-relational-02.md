# CHECKPOINT: Physical Accessory Products & Relational Branch Inventory Initialized

**Checkpoint Reference:** `CHECKPOINTS/accessory-inventory-relational-02.md`  
**Timestamp:** 2026-09-18 20:00:00 IST  
**Environment:** Next.js 14, PostgreSQL 17.6 (Supabase Pooler), Node.js  
**Branch:** `task/dev`  
**Head Commit:** `308162125fd72ef30c31176ac3312b9e15ff55a2`  
**Phases:** Phase 1 (Create Real Accessory Product Records) & Phase 2 (Create Branch Inventory) — COMPLETE  

---

## 1. Phase 1 Accomplishments: Real Accessory Product Records in PostgreSQL

1. **Pre-Migration Integrity Audit**:
   - Inspected `product`, `product_variant`, and `product_category` tables.
   - Verified zero colliding IDs (`acc_01`–`acc_08`), zero colliding SKUs, and zero colliding titles.
   - Compiled authoritative mapping saved to `scratch/accessory_product_migration_mapping.json`.
   - Created category record `cat_accessories` (handle: `accessories`, name: `Accessories`) in `product_category`.

2. **Product & Variant Insertion**:
   - Inserted 8 authentic physical accessory products into `product` with:
     - `pim_config.inventory_mode = 'STOCK_CONTROLLED'`
     - `category_slug = 'accessories'`
     - `primary_category_id = 'cat_accessories'`
     - Real titles, selling prices, cost prices, and MRPs
   - Inserted 8 corresponding `product_variant` records with:
     - `id`: `var_acc_01` through `var_acc_08`
     - `product_id`: `acc_01` through `acc_08`
     - `sku`: authentic SKUs (`ACC-TOP-GOLD`, `ACC-CAN-MAGIC`, etc.)
     - `manage_inventory`: `true`
   - Total rows in `product`: 62 (54 bakery + 8 physical accessories).
   - Zero schema DDL used.

---

## 2. Phase 2 Accomplishments: Relational `branch_inventory` Initialized

1. **Opening Stock Disclosure & Strategy**:
   - System audit confirmed that PostgreSQL previously contained strictly 0 rows in `branch_inventory` and zero per-branch inventory in branch metadata or `setting`.
   - To establish a safe, working production baseline without fabricating arbitrary numbers, the established static values from `DEFAULT_ACCESSORIES` were migrated as an explicitly identified temporary migration baseline:
     - `acc_01`: 45
     - `acc_02`: 80
     - `acc_03`: 120
     - `acc_04`: 25
     - `acc_05`: 18
     - `acc_06`: 30
     - `acc_07`: 50
     - `acc_08`: 12
   - These are recorded as migration baseline values, not historical audited physical inventory.

2. **Branch Inventory Population**:
   - Populated `branch_inventory` for all 53 non-deleted operational branches.
   - Total rows created: **`424`** (`53 branches × 8 accessories`).
   - Composite keys: `id = binv_{branch_id}_{variant_id}` conforming to index `IDX_branch_inventory_branch_variant`.
   - Verification: `quantity` > 0, `reserved = 0`, `deleted_at IS NULL`.
   - Branch isolation is now active at the PostgreSQL relational database level.

---

## 3. Next Safe Continuation Point

Proceeding to Phase 3 (Remove Static Inventory Authority & Fake Fallbacks) and Phase 4 (Branch-Specific Inventory API `GET /api/v1/accessories?branchId=...`).
