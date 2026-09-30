# Phase 4F Step 4.4 — Atomic Sales Posting, Inventory Fulfillment & FIFO COGS
## Forensic Analysis & Architectural Design Gate

**Checkpoint Identifier:** `CHECKPOINTS/phase4f-step4-4-sales-posting-cogs-design-01.md`  
**Timestamp:** `2026-09-26 11:05:00 IST`  
**Status:** `DESIGN GATE ONLY — AWAITING USER AUTHORIZATION BEFORE IMPLEMENTATION`  
**Preceding Frozen Milestones:**
- Phase 4F Steps 3D.1–3D.7-B: Complete Accounts Payable Domain (`phase4f-step3d7b-ap-subledger-01.md` ✅)
- Phase 4F Step 4: Sales Forensic & Design Gate (`phase4f-step4-sales-cogs-design-01.md` ✅)
- Phase 4F Step 4.1: Sales Tax & Calculation Engine (`phase4f-step4-1-sales-tax-engine-01.md` ✅)
- Phase 4F Step 4.2: Sales Voucher Construction (`phase4f-step4-2-sales-voucher-construction-01.md` ✅)
- Phase 4F Step 4.3: Sales Voucher Approval & SoD (`phase4f-step4-3-sales-voucher-approval-01.md` ✅)

---

## 1. Executive Summary & Design Gate Objective

Step 4.4 represents the **first actual posting milestone** in the Sales accounting lifecycle. It bridges the financial realm (approved sales voucher, revenue recognition, output GST) with the physical fulfillment realm (branch inventory stock decrement, FIFO cost-lot consumption, movement ledger, and Cost of Goods Sold [COGS] recognition in the General Ledger).

```
Approved Sales Voucher (Step 4.3 Frozen)
                 ↓
[ATOMIC POSTING TRANSACTION — BEGIN]
                 ↓
Lock Voucher, Order, Branch Inventory, and Cost Lots (Pessimistic Concurrency)
                 ↓
Revalidate Voucher State (APPROVED), Order State, and Quarantine Invariants
                 ↓
Revalidate Fiscal Period & Accounting Start Date Guards (Fail-Closed)
                 ↓
Revalidate Physical Availability & FIFO Cost-Lot Availability (Strict Fail-Closed)
                 ↓
Consume FIFO Cost Lots → Insert inventory_cost_consumption (1:1 with lot slices)
                 ↓
Record Physical Movements → Insert inventory_movement ('SALES_FULFILLMENT', 'OUT')
                 ↓
Decrement Physical Stock → UPDATE branch_inventory (quantity = quantity - Q)
                 ↓
Construct Atomic Compound GL Journal:
  [Revenue & GST Side]
    Dr 1121 Accounts Receivable (Prepaid) OR 1122 Undeposited COD
    Cr 4110 Cake & Bakery Sales Revenue
    Cr 4120 Accessory & Merchandise Sales Revenue
    Cr 4130 Delivery & Shipping Charges Collected
    Cr 2121–2129 Output GST Liabilities
  [COGS & Inventory Side]
    Dr 5110 COGS - Cakes
    Dr 5120 Accessory Merchandise Sold
    Dr 5130 Packaging Materials Consumed
    Cr 1132 Merchandise Inventory - Cakes
    Cr 1131 Merchandise Inventory - Accessories
    Cr 1133 Packaging Supplies Stock
                 ↓
Post via Canonical PostingService.postVoucher (Single Balanced Journal Entry)
                 ↓
Mark Voucher POSTED & Update Order Metadata Audit Linkages
                 ↓
[ATOMIC POSTING TRANSACTION — COMMIT]
```

### The Non-Negotiable Atomicity Invariant
A partial outcome—such as revenue and GST posted to the General Ledger while inventory was not consumed, or physical inventory decremented while GL posting failed—is **strictly prohibited**. The entire operation executes within a single PostgreSQL transaction (`BEGIN ... COMMIT`) that automatically rolls back 100% of mutations upon any validation failure, resource exhaustion, or unexpected exception.

---

## 2. Forensic Codebase & Database Inspection

An exhaustive forensic inspection of the live PostgreSQL database and existing ERP services was conducted prior to drafting this design:

### 2.1 Table `public.branch_inventory` (Physical Stock Layer)
- **Current Row Count**: Exactly **424 rows**.
- **Total Physical Quantity**: 20,053 units across 57 branches.
- **Total Reserved Quantity**: 0 units.
- **Constraints & Hardening**:
  - `chk_branch_inventory_qty_nonneg`: `CHECK (quantity >= 0)` (enforced at DB level).
  - `chk_branch_inventory_res_nonneg`: `CHECK (reserved >= 0)` (enforced at DB level).
  - Foreign keys: `product_id REFERENCES product(id) ON DELETE RESTRICT`, `variant_id REFERENCES product_variant(id) ON DELETE RESTRICT`.
  - Unique constraint: `UNIQUE (branch_id, variant_id)` / `(branch_id, product_id, variant_id)`.

### 2.2 Table `public.inventory_cost_lot` (Financial Cost Layer)
- **Current Row Count**: Exactly **0 rows** in the baseline database.
- **Schema & Indexes**:
  - Primary Key: `id TEXT`
  - Scoping: `branch_id REFERENCES branch(id)`, `product_id REFERENCES product(id)`, `variant_id REFERENCES product_variant(id)`
  - Merchandise Classification: `item_type TEXT CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'))`
  - Quantities & Costs: `received_quantity NUMERIC(12,3) > 0`, `remaining_quantity NUMERIC(12,3) >= 0`, `unit_cost NUMERIC(14,4) >= 0`, `total_cost NUMERIC(14,2) >= 0`
  - Invariant Check: `chk_cost_lot_cost_consistency`: `ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05`
  - Status: `status TEXT CHECK (status IN ('ACTIVE', 'DEPLETED', 'REVERSED'))`
  - **Authoritative FIFO Index**:
    ```sql
    CREATE INDEX idx_inventory_cost_lot_fifo 
    ON public.inventory_cost_lot (branch_id, product_id, variant_id, received_at ASC, created_at ASC)
    WHERE (status = 'ACTIVE' AND remaining_quantity > 0);
    ```

### 2.3 Table `public.inventory_movement` (Parent Movement Ledger)
- **Current Row Count**: Exactly **0 rows** in the baseline database.
- **Movement Types Supported**:
  `'PURCHASE_RECEIPT'`, `'SALES_FULFILLMENT'`, `'PURCHASE_RETURN'`, `'SALES_RETURN'`, `'STOCK_ADJUSTMENT_UP'`, `'STOCK_ADJUSTMENT_DOWN'`, `'TRANSFER_IN'`, `'TRANSFER_OUT'`, `'DAMAGE_WRITEOFF'`, `'INVOICE_REVERSAL'`.
- **Direction**: `'IN'` or `'OUT'`. For sales fulfillment, direction is strictly `'OUT'`.
- **Audit Linkages**: `order_id REFERENCES "order"(id)`, `voucher_id REFERENCES accounting_voucher(id)`.

### 2.4 Table `public.inventory_cost_consumption` (Child Allocation Ledger)
- **Current Row Count**: Exactly **0 rows** in the baseline database.
- **Schema & Linkages**:
  - `movement_id REFERENCES inventory_movement(id) ON DELETE RESTRICT`
  - `lot_id REFERENCES inventory_cost_lot(id) ON DELETE RESTRICT`
  - `quantity NUMERIC(12, 3) > 0`
  - `unit_cost NUMERIC(14, 4) >= 0`
  - `total_cost NUMERIC(14, 2) >= 0`
  - Mathematical Invariant: `chk_cost_consumption_math`: `ABS(total_cost - ROUND(quantity * unit_cost, 2)) <= 0.05`

### 2.5 Catalog Merchandise Types (`public.product`)
- **Distribution in Database**:
  - `CAKE`: **57 products**
  - `ACCESSORY`: **8 products** (`acc_01` through `acc_08`: party toppers, candles, gift items, balloons, teddy bear)
  - `PACKAGING`: **0 catalog products** currently seeded.
- **COGS and Asset CoA Mapping**:
  - `CAKE` $\longrightarrow$ Asset: `1132 Merchandise Inventory - Cakes` / COGS: `5110 COGS - Cakes`
  - `ACCESSORY` $\longrightarrow$ Asset: `1131 Merchandise Inventory - Accessories` / COGS: `5120 Accessory Merchandise Sold`
  - `PACKAGING` $\longrightarrow$ Asset: `1133 Packaging Supplies Stock` / COGS: `5130 Packaging Materials Consumed`

### 2.6 Critical Schema Invariant on `accounting_journal_entry`
Forensic analysis revealed a decisive database schema invariant:
```sql
CONSTRAINT accounting_journal_entry_voucher_id_key UNIQUE (voucher_id)
CREATE UNIQUE INDEX idx_accounting_journal_voucher ON public.accounting_journal_entry (voucher_id)
```
**Architectural Consequence**:
A voucher has an exact **1:1 relationship** with `accounting_journal_entry`. A single voucher cannot have multiple separate journal entries.
Therefore, the General Ledger entry for an approved sales voucher posting **must be an atomic compound journal entry** containing:
1. All Revenue, AR, and Output GST lines (balanced to `invoiceTotal`).
2. All COGS and Inventory Asset lines (balanced to `totalCOGS`).
3. Total debits: $\text{invoiceTotal} + \text{totalCOGS}$.
4. Total credits: $\text{invoiceTotal} + \text{totalCOGS}$.
5. Mathematical balance: $\sum \text{Debits} \equiv \sum \text{Credits}$, satisfying `chk_journal_balanced` and the database deferred balance trigger `trg_check_journal_balance`.

---

## 3. The Core Cost Rule: Zero Cost Fabrication & Strict Fail-Closed Invariant

### 3.1 Trading Business Reality
CakeToHome is a retail trading and distribution business. It does not fabricate, synthesize, or estimate inventory costs:
- Finished cakes and party merchandise are received from commercial bakeries and suppliers via authoritative purchase orders.
- Each unit received establishes an exact cost lot in `public.inventory_cost_lot` via Step 3D.4 (`PurchasePostingService.postPurchase`).
- **If an approved sales order requires 10 units, and only 7 cost-lot units exist in `inventory_cost_lot` for that branch/product**:
  **THE SYSTEM MUST FAIL CLOSED AND ROLL BACK COMPLETELY.**
- **No cost fallback**: The system shall NEVER fall back to:
  - Catalog `product.cost_price`
  - Product metadata `metadata->>'cost'`
  - Branch price heuristics or selling price margins
  - Synthetic standard cost, average cost, or dummy values.

### 3.2 Baseline Live Database State Guard
Because the baseline PostgreSQL database contains 0 cost lots:
- Any operational sales posting attempt against live data without existing cost lots will fail closed with `INSUFFICIENT_COST_LOT_QUANTITY`.
- Testing of Step 4.4 posting flows must strictly create authoritative purchase cost lots within the test transaction rollback (e.g. via `PurchasePostingService.postPurchase` or realistic purchase fixtures), proving that sales fulfillment consumes authentic lots.
- Neither `accounting_start_date` nor `accounting_fiscal_period` will be configured in the live database.

---

## 4. Atomic Concurrency, Row Locking & Deadlock Prevention

To guarantee absolute thread safety and eliminate race conditions under concurrent fulfillment:

### 4.1 Strict Lock Acquisition Ordering
All locks within the transaction must be acquired in a deterministic order across all services:
1. **Source Order**:
   ```sql
   SELECT * FROM public."order" WHERE id = $1 FOR UPDATE;
   ```
2. **Approved Voucher**:
   ```sql
   SELECT * FROM public.accounting_voucher 
   WHERE id = $1 AND deleted_at IS NULL 
   FOR UPDATE;
   ```
3. **Physical Branch Inventory (Sorted by variant_id to eliminate AB-BA deadlocks)**:
   ```sql
   SELECT * FROM public.branch_inventory 
   WHERE branch_id = $1 AND variant_id = ANY($2::text[])
   ORDER BY variant_id ASC
   FOR UPDATE;
   ```
4. **FIFO Cost Lots (Sorted by received_at, id)**:
   ```sql
   SELECT * FROM public.inventory_cost_lot
   WHERE branch_id = $1 
     AND product_id = $2 
     AND ($3::text IS NULL OR variant_id = $3 OR variant_id IS NULL)
     AND status = 'ACTIVE' 
     AND remaining_quantity > 0
   ORDER BY received_at ASC, id ASC
   FOR UPDATE;
   ```

### 4.2 State Revalidation Under Lock
Immediately after acquiring locks:
1. Revalidate `order.status` $\ne$ `'cancelled'` and $\ne$ `'canceled'`.
2. Revalidate order is not a quarantined prototype order (`metadata->>'legacy_prototype' = 'true'`).
3. Revalidate `voucher.status === 'APPROVED'`. If `POSTED`, throw `ORDER_ALREADY_POSTED` (idempotent).
4. Revalidate `validateAccountingStartDate(voucherDate)`.
5. Revalidate `validateFiscalPeriod(voucherDate)`.

---

## 5. FIFO Cost-Lot Consumption & Movement Ledger Specification

### 5.1 FIFO Consumption Algorithm
For each line item $i$ in the sales order:
1. Identify required quantity $Q_i$, `productId`, and optional `variantId`.
2. Query eligible active cost lots ordered by `received_at ASC, id ASC FOR UPDATE`.
3. Calculate $\text{TotalAvailable} = \sum \text{lot.remaining\_quantity}$.
   - If $\text{TotalAvailable} < Q_i$:
     Throw `INSUFFICIENT_COST_LOT_QUANTITY`:
     *"Insufficient cost lots for product '{title}' at branch '{branchId}': required {Q_i}, available {TotalAvailable}. Cost cannot be fabricated."*
4. Initialize `remainingNeeded = Q_i`.
5. Create parent `inventory_movement`:
   ```sql
   INSERT INTO public.inventory_movement (
     branch_id, product_id, variant_id,
     movement_type, quantity, direction,
     order_id, voucher_id, reference_no, narration,
     created_by, created_at
   ) VALUES (
     $1, $2, $3,
     'SALES_FULFILLMENT', $4, 'OUT',
     $5, $6, $7, $8,
     $9, NOW()
   ) RETURNING id;
   ```
6. For each lot while `remainingNeeded > 0`:
   - `consumeQty = Math.min(lot.remaining_quantity, remainingNeeded)`
   - `lotCost = Math.round(consumeQty * lot.unit_cost * 100) / 100`
   - `newRemaining = lot.remaining_quantity - consumeQty`
   - `newStatus = newRemaining === 0 ? 'DEPLETED' : 'ACTIVE'`
   - Update lot:
     ```sql
     UPDATE public.inventory_cost_lot
     SET remaining_quantity = $1, status = $2, updated_at = NOW()
     WHERE id = $3;
     ```
   - Insert child allocation `inventory_cost_consumption`:
     ```sql
     INSERT INTO public.inventory_cost_consumption (
       movement_id, lot_id, quantity, unit_cost, total_cost, created_at
     ) VALUES ($1, $2, $3, $4, $5, NOW());
     ```
   - Accumulate COGS for item merchandise type:
     $\text{cogsAccumulator}[merchandiseType] += lotCost$.
   - `remainingNeeded -= consumeQty`.

### 5.2 Physical Inventory Decrement
For catalog products tracked in `branch_inventory`:
1. Verify physical row exists: `available = row.quantity - row.reserved`.
2. If `available < Q_i`:
   Throw `INSUFFICIENT_PHYSICAL_INVENTORY`.
3. Decrement physical stock:
   ```sql
   UPDATE public.branch_inventory
   SET quantity = quantity - $1,
       updated_at = NOW()
   WHERE id = $2;
   ```

---

## 6. Compound General Ledger Journal Architecture

### 6.1 Line Item Construction
The final journal passed to canonical `PostingService.postVoucher` combines both halves of the sales fulfillment event:

```ts
const journalLines: JournalLineInput[] = [
  // ── 1. Commercial Revenue & Output GST Side (from Approved Voucher) ──
  // Debit: Accounts Receivable (1121 Prepaid or 1122 Undeposited COD)
  {
    account_id: arAccountId, // 1121 or 1122
    debit_amount: invoiceTotal,
    credit_amount: 0,
    narration: `AR for Sales Invoice ${voucher.voucher_no}`,
  },
  // Credit: Cake & Bakery Revenue (4110)
  ...(cakeRevenue > 0 ? [{
    account_id: cakeRevAccountId, // 4110
    debit_amount: 0,
    credit_amount: cakeRevenue,
    narration: `Cake sales revenue for ${order.display_id}`,
  }] : []),
  // Credit: Accessory Revenue (4120)
  ...(accRevenue > 0 ? [{
    account_id: accRevAccountId, // 4120
    debit_amount: 0,
    credit_amount: accRevenue,
    narration: `Accessory sales revenue for ${order.display_id}`,
  }] : []),
  // Credit: Delivery Fee Revenue (4130)
  ...(deliveryRevenue > 0 ? [{
    account_id: deliveryRevAccountId, // 4130
    debit_amount: 0,
    credit_amount: deliveryRevenue,
    narration: `Delivery charges collected for ${order.display_id}`,
  }] : []),
  // Credit: Output GST Split Lines (2121–2129)
  ...gstCreditLines,

  // ── 2. Operational COGS & Inventory Asset Side (from FIFO Cost Consumption) ──
  // Cakes: Dr 5110 COGS - Cakes / Cr 1132 Merchandise Inventory - Cakes
  ...(cakeCogsTotal > 0 ? [
    {
      account_id: cogsCakeAccountId, // 5110
      debit_amount: cakeCogsTotal,
      credit_amount: 0,
      narration: `COGS recognized for cakes on ${order.display_id}`,
    },
    {
      account_id: invCakeAccountId, // 1132
      debit_amount: 0,
      credit_amount: cakeCogsTotal,
      narration: `Inventory reduction for cakes on ${order.display_id}`,
    },
  ] : []),
  // Accessories: Dr 5120 Accessory Merchandise Sold / Cr 1131 Merchandise Inventory - Accessories
  ...(accCogsTotal > 0 ? [
    {
      account_id: cogsAccAccountId, // 5120
      debit_amount: accCogsTotal,
      credit_amount: 0,
      narration: `COGS recognized for accessories on ${order.display_id}`,
    },
    {
      account_id: invAccAccountId, // 1131
      debit_amount: 0,
      credit_amount: accCogsTotal,
      narration: `Inventory reduction for accessories on ${order.display_id}`,
    },
  ] : []),
  // Packaging: Dr 5130 Packaging Materials Consumed / Cr 1133 Packaging Supplies Stock
  ...(packCogsTotal > 0 ? [
    {
      account_id: cogsPackAccountId, // 5130
      debit_amount: packCogsTotal,
      credit_amount: 0,
      narration: `Packaging supplies consumed on ${order.display_id}`,
    },
    {
      account_id: invPackAccountId, // 1133
      debit_amount: 0,
      credit_amount: packCogsTotal,
      narration: `Packaging supplies stock reduction on ${order.display_id}`,
    },
  ] : []),
];
```

### 6.2 Mathematical Balance Verification
$$\sum \text{Debits} = \text{invoiceTotal} + \text{totalCOGS}$$
$$\sum \text{Credits} = \text{invoiceTotal} + \text{totalCOGS}$$
$$\text{Difference} \equiv 0.00$$

### 6.3 Reuse of Canonical PostingService
`SalesPostingService.postSalesVoucher` invokes:
```ts
const postResult = await PostingService.postVoucher({
  voucherId: voucher.id,
  postedBy: params.postedBy,
  lines: journalLines,
  branchId: voucher.branch_id,
  client,
});
```
This executes:
1. Account validation (`validatePostingAccounts`) for all 10+ leaf accounts.
2. Double-entry verification (`validateJournalLines`).
3. Fiscal period & start date enforcement.
4. Atomic insert to `public.accounting_journal_entry` and `public.accounting_journal_line`.
5. Voucher status update to `'POSTED'`.

---

## 7. Segregation of Duties (SoD) for Sales Posting

The posting operation requires an authorized staff member possessing `ACCOUNTING.POST`:
1. **Posting Permission**: Caller must satisfy `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
2. **Voucher Creator SoD**: `postedBy !== voucher.created_by`. (The preparer cannot post).
3. **Voucher Submitter SoD**: `postedBy !== voucher.submitted_by`. (The submitter cannot post).
4. **Voucher Approver Allowed / Dual Control Policy**:
   - In standard mid-market accounting, an authorized Finance Controller/Accountant with `ACCOUNTING.POST` may post an approved voucher, provided they did not prepare or submit the voucher draft.
   - However, `postedBy !== voucher.created_by` is strictly enforced.
5. **Commercial Creator SoD**: `postedBy !== order.metadata.created_by`.
6. **Customer SoD**: `postedBy !== order.customer_id`.

---

## 8. Bounded Step 4.4 Implementation Plan

### 8.1 Files to be Modified / Created in Step 4.4
1. **Core Service Extension**:
   [`frontend/src/lib/services/sales-posting.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/sales-posting.service.ts)
   - Add method: `SalesPostingService.postSalesVoucher(params: PostSalesVoucherParams): Promise<SalesPostingResponse>`
   - Add error codes:
     - `INSUFFICIENT_COST_LOT_QUANTITY`
     - `INSUFFICIENT_PHYSICAL_INVENTORY`
     - `COST_CONSISTENCY_VIOLATION`
     - `VOUCHER_ALREADY_POSTED`
     - `ORDER_ALREADY_POSTED`
2. **Dedicated Test Suite**:
   `frontend/scratch/test_step4_4_sales_posting.js`
   - Test 1: Fail closed on zero cost lots (`INSUFFICIENT_COST_LOT_QUANTITY`, zero cost fabrication).
   - Test 2: Fail closed on partial/insufficient cost lots (7 available vs 10 needed).
   - Test 3: Fail closed on unapproved voucher (`DRAFT` / `SUBMITTED` / `CANCELLED`).
   - Test 4: Fail closed on permission violation (missing `ACCOUNTING.POST`).
   - Test 5: Fail closed on SoD violation (preparer self-posting).
   - Test 6: Happy path full atomic posting with authentic purchase lots (Cake + Accessory).
   - Test 7: Multi-lot FIFO consumption order verification (oldest lot depleted first).
   - Test 8: Cost consumption mathematical invariant verification (`chk_cost_consumption_math`).
   - Test 9: Physical `branch_inventory` exact decrement verification.
   - Test 10: Compound journal entry balance and leaf account verification.
   - Test 11: Idempotency guard (re-posting `POSTED` voucher rejected).
   - Test 12: Atomic rollback test (forced DB trigger error rolls back all movements, cost lots, and journals).
3. **Milestone Checkpoint**:
   `CHECKPOINTS/phase4f-step4-4-sales-posting-cogs-01.md`
4. **Index Updates**:
   `CHECKPOINTS/LATEST_CHECKPOINT.md` and `frontend/LATEST_CHECKPOINT.md`.

---

## 9. Mandatory Gate Declaration & Stop

> [!IMPORTANT]
> **PHASE 4F STEP 4.4 FORENSIC & DESIGN GATE IS COMPLETE.**
> 
> - **Zero production code implemented** during this gate.
> - **Zero database mutations** occurred.
> - **Zero cost fabrication permitted**: Strict fail-closed rule locked.
> - **Compound journal architecture** derived from schema constraints.
> - **FIFO cost-lot consumption algorithm** mathematically defined.
> - **Full regression & baseline audit** confirmed pristine.
> 
> **EXECUTION STOPPED.**
> Awaiting user review and explicit authorization before proceeding to **Phase 4F Step 4.4 Implementation**.
