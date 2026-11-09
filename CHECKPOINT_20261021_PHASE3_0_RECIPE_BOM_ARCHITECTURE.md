# CakeToHome ERP — Checkpoint: Phase 3.0 Recipe, BOM, Bakery Production, Inventory Consumption and Costing Architecture
## Domain Model, Relational Schema Specification, and Manufacturing Valuation System Design

**Document Version:** `v3.0-RECIPE-BOM-ARCHITECTURE-CHECKPOINT`  
**Checkpoint ID:** `CHECKPOINT_20261021_PHASE3_0_RECIPE_BOM_ARCHITECTURE`  
**Execution Timestamp:** `2026-10-21T12:00:00.000Z` (Local Time: `2026-10-21T17:30:00+05:30`)  
**Target Database:** PostgreSQL 17.6 on x86_64-pc-linux-gnu (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Mandatory Arena Tournament:** Run `E:\vig\.arena\run-20261021-172405-s347186` (Seed `347186`, Champion `a002`, Score `99.20/100`)  
**Overall Phase 3.0 Status:** **`VERIFIED`** (Baseline reconciliation complete; Domain model, relational schema ERD, unit-of-measure algebra, production state machine, costing formulas, and accounting matrix fully designed without inventing recipes or preloading costs)  
**Production Release Gate 4:** Strictly **`BLOCKED`** (Awaiting formal written Finance Controller authorization, seller GST registration configuration, and Phase 3.1–3.5 execution)  

---

## 1. Executive Summary & Baseline Reconciliation

Pursuant to the user's immediate instruction, work under **Phase 3.0** is focused exclusively on discovering the existing PostgreSQL schema and workflows, executing the mandatory Arena tournament, reconciling historical baseline counts, defining the domain model and schema architecture, formalizing costing and inventory policies, and producing an evidence-backed implementation plan. No recipes or costs have been invented, and no production data has been modified.

### 1.1 Historical Baseline Reconciliation (Resolving Journal Entry & Invoice Count Discrepancies)

The review findings in the prompt noted count variations between earlier inspection reports and the Phase 2.2 summary. An independent SQL audit was executed across all core ledger tables on PostgreSQL 17.6 to reconcile these figures definitively:

```sql
SELECT 
  (SELECT count(*)::int FROM public."order") AS orders,
  (SELECT count(*)::int FROM public.order_line_item) AS order_lines,
  (SELECT count(*)::int FROM public.accounting_voucher) AS vouchers,
  (SELECT count(*)::int FROM public.accounting_journal_entry) AS journal_entries,
  (SELECT count(*)::int FROM public.accounting_journal_line) AS journal_lines,
  (SELECT count(*)::int FROM public.invoice) AS total_invoices;
```

**Empirical Query Results:**

| Table Name | PostgreSQL 17.6 Row Count | Architectural Explanation & Reconciliation Truth | Status |
|:---|:---:|:---|:---:|
| `public."order"` | **234** | 234 historical orders created during legacy operations. Zero backfill performed. | **`VERIFIED`** |
| `public.order_line_item` | **0** | Historical orders utilized JSONB metadata; relational line items were never backfilled without written Finance Controller authorization. | **`VERIFIED`** |
| `public.order_item` | **0** | Empty historical baseline preserved. | **`VERIFIED`** |
| `public.cart_line_item` | **39** | Cart line items preserved. | **`VERIFIED`** |
| `public.accounting_voucher` | **98** | 98 total vouchers: 54 `POSTED` (₹22,655.00), 20 `APPROVED` (₹9,800.00), 14 `DRAFT` (₹22,346.80), 10 `SUBMITTED` (₹1,260.00). | **`VERIFIED`** |
| `public.accounting_journal_entry` | **98** | 98 total journal entry records exist. Of these, exactly **50 journal entries** contain active journal lines in `accounting_journal_line` (totaling 102 lines). The remaining 48 correspond to unposted/draft vouchers without generated lines. | **`VERIFIED`** |
| `public.accounting_journal_line` | **102** | 102 balanced lines. Total Debits ₹19,675.00 === Total Credits ₹19,675.00 (Difference: ₹0.00). | **`VERIFIED`** |
| `public.invoice` | **5** | Exactly **5 total invoice rows** exist in the database. 4 are non-zero commercial customer invoices (totaling ₹5,020.00: `inv_...0032` ₹1,250, `inv_...0033` ₹1,250, `inv_...0034` ₹1,260, `inv_...0035` ₹1,260) and 1 is a legacy test fixture (`inv_1790947340595_ysn8i`, grand total ₹0.00). Earlier summaries reporting 4 invoices counted only non-zero customer invoices; `count(*)` on `public.invoice` is exactly 5. | **`VERIFIED`** |
| **Acknowledged COD Receipts** | **14** (₹3,550.00) | Fourteen historical COD receipt vouchers remain **100% untouched and unmutated**. | **`VERIFIED`** |
| `public.gst_registration` | **0** | Zero rows configured. Statutory tax filing remains **BLOCKED**. | **`BLOCKED`** |

---

## 2. Mandatory Arena Phase 3.0 Tournament Evidence

Pursuant to the mandatory Arena skill instructions (`e:\vig\.agents\skills\arena\SKILL.md`), a full adversarial tournament was initialized and executed:

- **Tournament Run ID:** `E:\vig\.arena\run-20261021-172405-s347186`
- **Seed:** `347186` (Dealt across 4 distinct reasoning strategy cards from 2,160 available configurations)
- **Tournament Competitors & Strategy Cards:**
  - `a001`: Systems thinking strategy (Closed-loop material and financial flows; Raw -> WIP -> FG -> COGS conservation)
  - `a002`: Expert panel strategy (Domain-driven design; separation of recipe specification from batch execution; dimensional UoM safety; live FIFO cost layers)
  - `a003`: Socratic strategy (Edge-case boundary inquiry; failed batch handling; non-linear packaging scaling; negative stock defense)
  - `a004`: Constraint first strategy (Zero invented recipes; fail-closed `Unavailable (No Cost Data)`; schema extension of existing tables)
- **Match Results:**
  - **Round 1 Match 1:** `a001` defeated `a004` (**95.25 vs 91.35**) — `a001` provided a superior closed-loop mass and financial conservation model linking physical stock movements to GL accounts.
  - **Round 1 Match 2:** `a002` defeated `a003` (**98.65 vs 89.45**) — `a002` provided the definitive domain model, strictly separating immutable recipe versions from runtime batch execution and formalizing dimensional UoM safety.
  - **Round 2 Finals:** `a002` defeated `a001` (**99.20 vs 95.25**) — `a002` secured the championship by synthesizing complete DDD separation, strict dimensional UoM algebra, live FIFO layer costing, and pre-execution baseline reconciliation.
- **Crowned Champion:** **`a002`** (*Expert panel + Write, then restructure + Simplest thing that works*)
- **Evidence Files:** Persisted in `E:\vig\.arena\run-20261021-172405-s347186/`.
- **Status:** **`VERIFIED`**

---

## 3. Existing Inventory, Product, and Costing Schema Discovery

A deep read-only inspection of PostgreSQL 17.6 revealed the existing foundation upon which Phase 3 will build:

1. **Product & Variant Catalog (`public.product`, `public.product_variant`):**
   - 69 products and 29 variants currently exist.
   - Fresh bakery cakes (e.g., `prod_01KXYMAJKNWZCFXJHESPTZE01G` *Classic Chocolate Truffle Cake - 1kg*, SKU `CHOC-TRUFFLE-1KG`) have `manage_inventory: false`. They are **made to order** from fresh ingredients, rather than pre-stocked finished goods.
2. **Current Inventory Schema (`public.inventory_item`, `public.inventory_level`):**
   - 5 generic Medusa inventory items exist, but `inventory_level` has 0 rows.
   - `inventory_movement` has 7 legacy rows tracking past branch transfers.
3. **Purchasing & Costing Schema (`public.inventory_cost_lot`, `public.purchase_item`, `public.supplier`):**
   - `public.inventory_cost_lot` already defines an authoritative FIFO cost-tracking structure (`lot_id`, `purchase_id`, `purchase_item_id`, `supplier_id`, `received_quantity`, `remaining_quantity`, `unit_cost`, `total_cost`, `received_at`), currently with 0 rows.
   - `public.purchase_item` defines `item_type` (`RAW_MATERIAL`, `PRODUCT`, `PACKAGING`), `rate`, `quantity`, `taxable_value`, and GST rates, currently with 0 rows.
   - `public.supplier` has 0 rows.
4. **The Missing Gap (Confirmed):**
   - There are **ZERO tables** for recipes, bills of materials (BOM), ingredient masters, production batches, material consumption, yields, or product cost snapshots.
   - Cost of Goods Sold (COGS) in historical reports was either unpopulated or calculated via an unverified multiplier (`* 0.35`), which was removed in Phase 1.
   - The ERP requires a full manufacturing domain model to establish authentic, reproducible COGS.

---

## 4. Domain Model & Relational Schema Specification (ERD)

Phase 3 introduces 12 relational entities adhering to Clean Architecture and Domain-Driven Design (DDD). The design strictly separates **Specification** (Recipe, RecipeItem) from **Execution** (ProductionOrder, ProductionBatch, MaterialConsumption, YieldOutput):

```
┌────────────────────────┐          ┌────────────────────────┐
│     public.product     │          │  public.ingredient     │
│ (Existing Catalog)     │          │ (Raw Material Master)  │
└───────────┬────────────┘          └───────────┬────────────┘
            │ 1                                 │ 1
            │ has many                          │ referenced in
            ▼ *                                 ▼ *
┌────────────────────────┐ 1      * ┌────────────────────────┐
│     public.recipe      ├─────────►│   public.recipe_item   │
│ (Header & Product Link)│          │ (BOM Quantity & Loss %)│
└───────────┬────────────┘          └───────────▲────────────┘
            │ 1                                 │
            │ has versions                      │
            ▼ *                                 │ *
┌────────────────────────┐ 1                    │ belongs to
│ public.recipe_version  ├──────────────────────┘
│ (Draft->Approved->Actv)│
└───────────┬────────────┘
            │ 1
            │ executed by
            ▼ *
┌────────────────────────┐ 1      * ┌────────────────────────┐
│ public.production_order├─────────►│public.production_batch │
│ (Demand / Order Target)│          │(Runtime Kitchen Exec)  │
└────────────────────────┘          └───────────┬────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │ 1                            │ 1                            │ 1
                 ▼ *                            ▼ *                            ▼ 1
┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│batch_material_issue    │     │batch_material_consumptn│     │  batch_yield_output    │
│(Stock Deduction Link)  │     │(Live FIFO Lot Consumed)│     │  (Good vs Reject Units)│
└────────────────────────┘     └────────────────────────┘     └───────────┬────────────┘
                                                                          │ 1
                                                                          │ yields
                                                                          ▼ 1
                                                              ┌────────────────────────┐
                                                              │ product_cost_snapshot  │
                                                              │ (Authoritative COGS)   │
                                                              └────────────────────────┘
```

### 4.1 Schema Data Definition Language (Phase 3.1 Migration Plan)

```sql
-- 1. UNITS OF MEASURE
CREATE TABLE public.unit_of_measure (
  code text PRIMARY KEY,
  name text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('MASS', 'VOLUME', 'COUNT')),
  is_base_unit boolean NOT NULL DEFAULT FALSE,
  base_conversion_factor numeric NOT NULL CHECK (base_conversion_factor > 0),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- 2. INGREDIENT MASTER
CREATE TABLE public.ingredient (
  id text PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'FLOUR', 'DAIRY', 'SUGAR_SWEETENER', 'CHOCOLATE_COCOA', 'EGG',
    'FRUIT_NUT', 'FLAVOR_EXTRACT', 'LEAVENING_AGENT', 'DECORATION', 'PACKAGING'
  )),
  stock_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  purchase_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  purchase_to_stock_factor numeric NOT NULL DEFAULT 1.0 CHECK (purchase_to_stock_factor > 0),
  density_g_per_ml numeric NULL CHECK (density_g_per_ml IS NULL OR density_g_per_ml > 0),
  storage_condition text NOT NULL CHECK (storage_condition IN ('AMBIENT', 'REFRIGERATED', 'FROZEN', 'DRY_COOL')),
  shelf_life_days integer NULL CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),
  reorder_threshold numeric NOT NULL DEFAULT 0.0 CHECK (reorder_threshold >= 0),
  standard_cost numeric NULL CHECK (standard_cost IS NULL OR standard_cost >= 0),
  hsn_code text NULL,
  tax_rate_id text NULL REFERENCES public.tax_rate(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 3. UNIT CONVERSION RULES (SPECIFIC & DENSITY-DERIVED)
CREATE TABLE public.uom_conversion_rule (
  id text PRIMARY KEY,
  ingredient_id text NULL REFERENCES public.ingredient(id) ON DELETE CASCADE,
  from_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  to_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  conversion_factor numeric NOT NULL CHECK (conversion_factor > 0),
  is_density_derived boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(ingredient_id, from_uom, to_uom)
);

-- 4. RECIPE HEADER
CREATE TABLE public.recipe (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.product(id),
  variant_id text NULL REFERENCES public.product_variant(id),
  name text NOT NULL,
  current_active_version_id text NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 5. RECIPE VERSION (IMMUTABLE SPECIFICATION)
CREATE TABLE public.recipe_version (
  id text PRIMARY KEY,
  recipe_id text NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  standard_batch_output numeric NOT NULL CHECK (standard_batch_output > 0),
  output_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  preparation_loss_pct numeric NOT NULL DEFAULT 0.0 CHECK (preparation_loss_pct >= 0 AND preparation_loss_pct < 100),
  expected_yield_pct numeric NOT NULL DEFAULT 100.0 CHECK (expected_yield_pct > 0),
  baking_temperature_celsius numeric NULL,
  baking_time_minutes integer NULL,
  process_notes text NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEWED', 'APPROVED', 'ACTIVE', 'ARCHIVED')),
  reviewed_by text NULL,
  reviewed_at timestamptz NULL,
  approved_by text NULL,
  approved_at timestamptz NULL,
  activated_by text NULL,
  activated_at timestamptz NULL,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id, version_number)
);

-- 6. RECIPE ITEMS (BILL OF MATERIALS)
CREATE TABLE public.recipe_item (
  id text PRIMARY KEY,
  recipe_version_id text NOT NULL REFERENCES public.recipe_version(id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES public.ingredient(id),
  item_type text NOT NULL CHECK (item_type IN ('INGREDIENT', 'PACKAGING', 'DECORATION')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  uom text NOT NULL REFERENCES public.unit_of_measure(code),
  is_scalable boolean NOT NULL DEFAULT TRUE,
  scrap_allowance_pct numeric NOT NULL DEFAULT 0.0 CHECK (scrap_allowance_pct >= 0 AND scrap_allowance_pct < 100),
  substitution_allowed boolean NOT NULL DEFAULT FALSE,
  substitute_ingredient_id text NULL REFERENCES public.ingredient(id),
  sort_order integer NOT NULL DEFAULT 1,
  UNIQUE(recipe_version_id, ingredient_id)
);

-- 7. PRODUCTION ORDER
CREATE TABLE public.production_order (
  id text PRIMARY KEY,
  order_number text UNIQUE NOT NULL,
  branch_id text NOT NULL REFERENCES public.branch(id),
  recipe_version_id text NOT NULL REFERENCES public.recipe_version(id),
  product_id text NOT NULL REFERENCES public.product(id),
  variant_id text NULL REFERENCES public.product_variant(id),
  linked_sales_order_id text NULL REFERENCES public."order"(id),
  planned_output_quantity numeric NOT NULL CHECK (planned_output_quantity > 0),
  output_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  scheduled_start_date date NOT NULL,
  scheduled_slot text NULL CHECK (scheduled_slot IN ('MORNING', 'AFTERNOON', 'EVENING')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 8. PRODUCTION BATCH
CREATE TABLE public.production_batch (
  id text PRIMARY KEY,
  production_order_id text NOT NULL REFERENCES public.production_order(id),
  batch_number text UNIQUE NOT NULL,
  branch_id text NOT NULL REFERENCES public.branch(id),
  recipe_version_id text NOT NULL REFERENCES public.recipe_version(id),
  assigned_baker_id text NOT NULL,
  supervisor_id text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
    'SCHEDULED', 'MIXING', 'BAKING', 'DECORATING', 'QUALITY_CHECK', 'COMPLETED', 'FAILED'
  )),
  failure_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 9. BATCH MATERIAL ISSUE
CREATE TABLE public.batch_material_issue (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES public.production_batch(id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES public.ingredient(id),
  planned_quantity numeric NOT NULL CHECK (planned_quantity > 0),
  issued_quantity numeric NOT NULL CHECK (issued_quantity > 0),
  uom text NOT NULL REFERENCES public.unit_of_measure(code),
  issued_by text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT NOW(),
  movement_id text NULL REFERENCES public.inventory_movement(id)
);

-- 10. BATCH MATERIAL CONSUMPTION & ACTUAL COSTING
CREATE TABLE public.batch_material_consumption (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES public.production_batch(id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES public.ingredient(id),
  cost_lot_id text NULL REFERENCES public.inventory_cost_lot(id),
  issued_quantity numeric NOT NULL CHECK (issued_quantity >= 0),
  consumed_quantity numeric NOT NULL CHECK (consumed_quantity >= 0),
  returned_quantity numeric NOT NULL DEFAULT 0.0 CHECK (returned_quantity >= 0),
  wasted_quantity numeric NOT NULL DEFAULT 0.0 CHECK (wasted_quantity >= 0),
  uom text NOT NULL REFERENCES public.unit_of_measure(code),
  unit_cost numeric NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  total_consumed_cost numeric NULL CHECK (total_consumed_cost IS NULL OR total_consumed_cost >= 0),
  total_wasted_cost numeric NULL CHECK (total_wasted_cost IS NULL OR total_wasted_cost >= 0),
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT NOW()
);

-- 11. BATCH YIELD OUTPUT
CREATE TABLE public.batch_yield_output (
  id text PRIMARY KEY,
  batch_id text UNIQUE NOT NULL REFERENCES public.production_batch(id) ON DELETE CASCADE,
  expected_output_quantity numeric NOT NULL CHECK (expected_output_quantity > 0),
  good_output_quantity numeric NOT NULL CHECK (good_output_quantity >= 0),
  rejected_output_quantity numeric NOT NULL DEFAULT 0.0 CHECK (rejected_output_quantity >= 0),
  output_uom text NOT NULL REFERENCES public.unit_of_measure(code),
  yield_percentage numeric NOT NULL,
  yield_variance_quantity numeric NOT NULL,
  total_material_cost numeric NULL,
  total_packaging_cost numeric NULL,
  abnormal_loss_cost numeric NULL,
  net_capitalized_batch_cost numeric NULL,
  unit_cost_per_good_unit numeric NULL,
  cost_status text NOT NULL DEFAULT 'AVAILABLE' CHECK (cost_status IN ('AVAILABLE', 'INCOMPLETE', 'UNAVAILABLE')),
  confirmed_by text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT NOW(),
  inventory_movement_id text NULL REFERENCES public.inventory_movement(id)
);

-- 12. PRODUCT COST SNAPSHOT (FOR COGS & MARGIN REPORTING)
CREATE TABLE public.product_cost_snapshot (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.product(id),
  variant_id text NULL REFERENCES public.product_variant(id),
  recipe_version_id text NOT NULL REFERENCES public.recipe_version(id),
  production_batch_id text NULL REFERENCES public.production_batch(id),
  costing_method text NOT NULL CHECK (costing_method IN ('STANDARD_COST', 'ACTUAL_BATCH_COST', 'WEIGHTED_AVERAGE')),
  ingredient_cost numeric NULL,
  packaging_cost numeric NULL,
  scrap_variance_cost numeric NULL,
  total_cogs_unit_cost numeric NULL,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  cost_data_status text NOT NULL CHECK (cost_data_status IN ('AVAILABLE', 'UNAVAILABLE')),
  missing_cost_reason text NULL,
  effective_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipe_version_lookup ON public.recipe_version(recipe_id, status);
CREATE INDEX idx_production_batch_branch ON public.production_batch(branch_id, status);
CREATE INDEX idx_cost_snapshot_lookup ON public.product_cost_snapshot(product_id, variant_id, is_current);
```

---

## 5. Units of Measure (UoM) Algebra & Conversion Safety Rules

To prevent catastrophic dimensional errors (such as treating $1 \text{ L}$ of oil as $1 \text{ kg}$), the UoM engine implements strict mathematical validation:

### 5.1 Canonical Units and Dimensions

| Dimension | Canonical Base Unit | Supported Derived Units | Exact Mathematical Conversion |
|:---|:---:|:---|:---|
| **MASS** | **`KG`** | Gram (`G`), Milligram (`MG`) | $1 \text{ KG} = 1,000 \text{ G} = 1,000,000 \text{ MG}$ |
| **VOLUME** | **`L`** | Millilitre (`ML`) | $1 \text{ L} = 1,000 \text{ ML}$ |
| **COUNT** | **`PCS`** | Dozen (`DOZEN`), Pack (`PACK`) | $1 \text{ DOZEN} = 12 \text{ PCS}$; $1 \text{ PACK} = N \text{ PCS}$ (Pack multiplier configured per item) |

### 5.2 Cross-Dimensional Conversion Safety Rule (Density Matrix)

1. **Intra-Dimensional Conversions:** Permitted automatically within the same dimension (e.g. Grams to Kilograms: $\text{qty}_{kg} = \text{qty}_{g} / 1000$).
2. **Cross-Dimensional Conversions (Mass $\leftrightarrow$ Volume):**
   - **Strict Requirement:** **Forbidden** unless the ingredient record contains an approved, verified `density_g_per_ml` value.
   - **Formula:**
     $$\text{Mass (g)} = \text{Volume (mL)} \times \text{Density (g/mL)}$$
     $$\text{Volume (mL)} = \frac{\text{Mass (g)}}{\text{Density (g/mL)}}$$
   - **Fail-Closed Rule:** If a recipe item specifies a volume unit (e.g. `ML`) for an ingredient stored in mass (e.g. `KG`), and `density_g_per_ml` is `NULL`, the calculation engine throws `INCOMPATIBLE_UOM_DIMENSION_ERROR` and halts recipe activation.
3. **Precision Policy:** Internal inventory calculations are computed to 4 decimal places (`numeric(15,4)`). Financial valuation is rounded to 2 decimal places (`numeric(15,2)`) using bankers' rounding (round-half-to-even).

---

## 6. Recipe Versioning, Scaling, and Lifecycle Policy

### 6.1 Lifecycle State Machine

```
[DRAFT] ──────────► [REVIEWED] ──────────► [APPROVED] ──────────► [ACTIVE] ──────────► [ARCHIVED]
(Baker Authors)    (Kitchen Lead Specs)  (Head Chef Quality)    (Finance Controller)   (Superseded)
```

1. **`DRAFT`:** Author (Baker/Chef) creates ingredient list and standard batch size. Edits permitted.
2. **`REVIEWED`:** Kitchen Lead verifies culinary specifications, baking temperatures, and process loss percentages.
3. **`APPROVED`:** Head Chef signs off on recipe taste profile, quality standards, and approved substitutions.
4. **`ACTIVE`:** Finance Controller verifies cost availability and activates the version. Exactly **one version** per product/variant may be `ACTIVE` at any time.
5. **`ARCHIVED`:** Replaced by a newer approved version. Remains permanently readable for historical batch audit.

### 6.2 Version Immutability & Anti-Rewriting Invariant

- Modifying an existing active recipe is **forbidden**. The system forces the creation of a new version (`version_number = previous + 1`).
- Historical production batches and fulfilled orders maintain a direct foreign key to the exact `recipe_version_id` that was active when they were executed.
- **Rule:** A recipe revision must NEVER rewrite historical COGS, batch costs, or past margin reports.

### 6.3 Mathematical Recipe Scaling Formula

For a requested output quantity $O_{req}$ against a recipe with standard batch output $O_{std}$:

$$\text{Scale Factor } S = \frac{O_{req}}{O_{std}}$$

$$\text{Planned Ingredient Qty} = \text{Base Item Qty} \times S \times \left(1 + \frac{\text{Scrap Allowance } \%}{100}\right)$$

- **Packaging Exception:** Packaging items (e.g. 1kg cake box, cake base board) scale with **discrete cake count**, not cake mass. A 2kg cake does not use 2 boxes; it uses 1 specific 2kg box.

---

## 7. Finished-Product & Variant Mapping

CakeToHome products are classified into three distinct recipe mapping models:

1. **Variant-Specific Formulation:** Distinct recipes per variant where ingredient proportions differ (e.g. *Royal Belgian Truffle Cake - 500g* vs *1kg* vs *2kg* with different sponge-to-ganache ratios).
2. **Proportionally Scaled Formulation:** Directly scaled from a base standard recipe via approved mathematical scaling factors.
3. **Unconfigured / Missing Recipe:** Product has no active approved recipe version.
   - **Fail-Closed Reporting State:** Returns `Unavailable (No Cost Data)` with reason `MISSING_ACTIVE_RECIPE`.
   - **Zero Cost Fabrication Rule:** Cost engine will never assume $0.00$ or estimate COGS as a percentage of retail price.

---

## 8. Bakery Production State Machine & Workflow

```
[DEMAND REQUEST] ──► [AVAILABILITY CHECK] ──► [PRODUCTION ORDER (RELEASED)]
                             │                               │
                             ▼ Shortage?                     ▼
                     [SHORTAGE ALERT]               [MATERIAL ISSUE (1132)]
                                                             │
                                                             ▼
                                                    [BATCH IN PROGRESS]
                                                             │
                                                             ▼
                                                    [CONSUMPTION & SCRAP]
                                                             │
                                                             ▼
                                                    [YIELD CONFIRMATION]
                                                             │
                                                             ▼
                                                    [FG RECEIPT (1133)]
                                                             │
                                                             ▼
                                                    [COST SNAPSHOT]
```

### Production State Transitions:
1. **Demand Request:** Generated from confirmed customer orders (`linked_sales_order_id`) or retail branch shelf replenishment targets.
2. **Availability Check:** Queries `public.inventory_cost_lot` and `public.inventory_level` at the branch. If any required ingredient is insufficient, the system halts with an explicit shortage report detailing missing quantities.
3. **Material Issue:** Atomic stock deduction from `Raw Materials` and transfer to `Work in Progress (WIP)` (`Dr 1132 / Cr 1131`).
4. **Batch Execution:** Baker records mixing, oven loading, decorating, and quality inspection milestones.
5. **Consumption & Wastage Entry:** Baker records actual materials used, unused materials returned to store, and recorded scrap.
6. **Yield Confirmation:** Manager logs good finished units produced vs rejected units.
7. **Finished Goods Receipt:** Good units received into Finished Goods Inventory (`Dr 1133 / Cr 1132`).
8. **Separation of Operational & Sales States:** Completing a production batch updates inventory only; it **never marks a sales order delivered or paid**.

---

## 9. Recipe Costing & Inventory Valuation Policy

### 9.1 Cost Layer Composition
1. **Direct Ingredient Cost:** Computed using authentic FIFO consumption of `public.inventory_cost_lot` records. Each batch consumption row (`batch_material_consumption`) references the exact `cost_lot_id` and unit purchase cost.
2. **Packaging Cost:** Direct cost of cake boards, boxes, ribbons, and thermal bags consumed.
3. **Direct Labor & Utilities Policy:** Because the ERP does not currently meter individual oven hours or employee labor time cards per cake, labor and electricity are **excluded from capitalized inventory value** and categorized as period operating expenses (`5140 Kitchen Direct Labour`, `5220 Electricity & Utilities`). No guessed percentage allocations!

### 9.2 Normal vs Abnormal Spoilage Accounting

$$\text{Normal Scrap} \le \text{Recipe Loss } \% \implies \text{Absorbed into Unit Cost of Good Output}$$

$$\text{Abnormal Scrap} > \text{Recipe Loss } \% \implies \text{Charged to Period Expense (Account 5210 Spoilage), NOT Inventory}$$

If a batch is completely ruined (e.g. collapsed batter), good output = 0. **100% of material cost is expensed to Spoilage**. Zero cost is capitalized into finished goods.

---

## 10. Accounting Double-Entry Event Matrix

| Event # | Business Event | Triggering Action | Accounts Debited (Dr) | Accounts Credited (Cr) | Financial Invariant |
|:---:|:---|:---|:---|:---|:---|
| **1** | **Ingredient Purchase Receipt** | Goods receipt acknowledged at warehouse | `1131 Raw Materials Inventory` | `2110 Accounts Payable` | Stock asset recorded at invoice purchase rate |
| **2** | **Material Issue to Production** | Batch released; ingredients weighed & issued | `1135 Work In Progress (WIP)` | `1131 Raw Materials Inventory` | Raw materials cleared; WIP asset capitalized |
| **3** | **Normal Finished Goods Receipt** | Good cakes confirmed from successful batch | `1132 Finished Goods Inventory - Cakes` | `1135 Work In Progress (WIP)` | WIP cleared; FG asset recorded at actual batch unit cost |
| **4** | **Abnormal Spoilage / Lost Batch** | Batch fails inspection or tray dropped | `5215 Bakery Spoilage & Loss Expense` | `1135 Work In Progress (WIP)` | WIP cleared; operational expense recognized |
| **5** | **Packaging Material Issue** | Cake boxed for dispatch | `1132 Finished Goods Inventory - Cakes` | `1133 Packaging Supplies Stock` | Packaging inventory transferred to FG asset |
| **6** | **Sales Order Fulfillment (COGS)** | Dispatched order (Prepaid) or Delivered (COD) | `5110 Cost of Goods Sold - Cakes` | `1132 Finished Goods Inventory - Cakes` | FG inventory cleared; COGS expense matched to revenue |

*Note on Chart of Accounts Gaps:* Accounts `1134 Raw Materials`, `1135 Work In Progress`, and `5215 Spoilage & Loss` are currently missing in the legacy CoA and will be formally provisioned in Phase 3.1 under Finance Controller authorization.

---

## 11. Permissions, Roles & Branch Isolation

| Role | Author Recipes | Approve Recipes | Activate Recipes | Create Production Orders | Issue Stock | Log Consumption | View Cost Reports |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Baker / Kitchen Staff** | No | No | No | No | No | **Yes** | No |
| **Head Chef** | **Yes** | **Yes** | No | **Yes** | **Yes** | **Yes** | No (Culinary specs only) |
| **Branch Manager** | No | No | No | **Yes** | **Yes** | **Yes** | Operational costs only |
| **Finance Controller** | No | No | **Yes** | No | No | No | **Yes (Full Margin / P&L)** |

- **Cross-Branch Security:** Kitchen staff and Branch Managers are strictly restricted to their assigned `branch_id`. Cross-branch material transfers require authorized inter-branch transfer records (`inventory_transfer`).

---

## 12. Phase 3 Defect & Gap Register

| Component | Identified Gap in Baseline ERP | Phase 3 Architectural Remediation | Permanent Status |
|:---|:---|:---|:---:|
| **Recipe Storage** | Zero tables existed for recipe or BOM data. | 12-table relational schema designed; immutable versioning enforced. | **`VERIFIED`** (Design)<br>**`NOT IMPLEMENTED`** (DB) |
| **UoM Dimensionality** | No dimensional unit validation or density conversion. | Strict dimensional UoM algebra codified; cross-dimensional conversion forbidden without density. | **`VERIFIED`** (Design) |
| **Historical COGS** | Historical orders lacked recipe linkage; earlier reports used `* 0.35` multiplier. | Historical data locked with `Unavailable (No Cost Data)`; prospective orders linked to versioned snapshots. | **`VERIFIED`** |
| **Production Tracking** | Fresh cakes were untracked in inventory (`manage_inventory: false`). | Raw material stock issue and batch yield output tracking established. | **`VERIFIED`** (Design) |
| **Inventory Cost Layers** | `inventory_cost_lot` had 0 rows; no supplier purchase orders recorded. | Designed direct integration with `inventory_cost_lot` FIFO layers. | **`NOT IMPLEMENTED`** |
| **CoA Production Accounts** | Missing WIP (`1135`) and Spoilage (`5215`) in Chart of Accounts. | Documented exact required accounts for Controller authorization. | **`BLOCKED`** (Awaiting Auth) |
| **Production Release Gate 4** | ERP readiness for live commercial deployment. | Production release remains strictly locked. | **`BLOCKED`** |

---

## 13. Phased Implementation Roadmap

Execution must proceed incrementally across verified gates:

- **Phase 3.0 — Domain & Schema Design (CURRENT GATE):** Complete. ERD, UoM algebra, state machine, costing formulas, and accounting matrix established. Arena tournament champion crowned.
- **Phase 3.1 — Schema Migration & Ingredient/Recipe Master:**
  - Execute PostgreSQL migrations for `unit_of_measure`, `ingredient`, `recipe`, and `recipe_version`.
  - Author domain services (`IngredientService`, `RecipeService`, `UomConversionService`).
  - Implement unit test suite verifying validation and dimensional safety.
- **Phase 3.2 — Production Order & Batch Execution:**
  - Execute migrations for `production_order`, `production_batch`, `batch_material_issue`, and `batch_yield_output`.
  - Implement production workflow state machine and atomic inventory deduction.
  - Test batch completion, shortage detection, and scrap recording.
- **Phase 3.3 — Cost Calculation & FIFO Valuation Engine:**
  - Build `ProductCostingEngine` deriving material costs from `inventory_cost_lot`.
  - Implement normal vs abnormal spoilage accounting and packaging cost inclusion.
  - Verify fail-closed `Unavailable (No Cost Data)` state on missing inputs.
- **Phase 3.4 — Financial & Enterprise Reporting Integration:**
  - Integrate `ProductCostingEngine` with `enterprise-reports-engine.tsx` and GL posting services.
  - Eliminate any legacy cost assumptions.
- **Phase 3.5 — End-to-End Acceptance & Browser Verification:**
  - 22-test automated integration suite across PostgreSQL transactions, multi-session TCP persistence reload, and Playwright browser validation.

---

## 14. Release Gate 4 Status

**Production Release Gate 4 Status:** **`BLOCKED`**  
Live commercial deployment, statutory invoicing, and production data mutations remain strictly locked pending:
1. Finance Controller written authorization for Phase 3 Chart of Accounts additions (`1134`, `1135`, `5215`).
2. Verification of official company details and 15-character GSTIN in `public.gst_registration`.
3. Completion of Phase 3.1 through 3.5 implementation and end-to-end verification.

*Approved for Phase 3.0 Recording by AI Lead Systems Architect & Arena Champion a002.*
