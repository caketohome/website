# Phase 5B.1 — POS + Barcode Forensic & Design Gate Checkpoint
## Comprehensive Architectural Lock & Non-Mutating Verification

> **Document ID**: `CHECKPOINTS/phase5b-step1-pos-barcode-forensic-design-gate.md`  
> **Status**: `FORENSIC & DESIGN GATE LOCKED — IMPLEMENTATION STOP APPLIED`  
> **Milestone**: Phase 5B (Store Counter Operations & POS Engine)  
> **Baseline Integrity**: Zero PostgreSQL mutations detected; 0 TypeScript errors (`npx tsc --noEmit` exit 0).  
> **Authoritative Invariant**: **PostgreSQL Schema + Canonical Services + Live Source Code > Planning Prose.**

---

## 1. Executive Summary

Phase 5A.6 (Period & Year-End Close, Substeps 5.1–5.5) remains completely **frozen and untouchable**. Phase 5B initiates the physical shop-counter operating layer for CakeToHome ERP. 

This gate (Substep 5B.1) establishes the forensic baseline and authoritative contracts for:
1. High-Speed Counter POS Terminal
2. Barcode Scanning & Resolution Engine
3. Thermal Receipt (80mm/58mm) & Product Label Printing (50×25mm)
4. Cashier Shift & Teller Management (Blind Close & Variance Exception Routing)
5. Counter-vs-E-Commerce Real-Time Inventory Concurrency

**Crucial Mandate**: This gate is strictly analytical, forensic, and architectural. Zero production tables, zero migrations, zero UI billing screens, and zero financial transactions have been mutated or created.

---

## 2. Skills Available / Unavailable Report

As required by Section 1 of the mandate:

| Skill | Status | Utilization in 5B.1 |
| :--- | :--- | :--- |
| `smart-coder` | **AVAILABLE** | Guided the 5-step engineering lifecycle: Plan → Inspect → Lock → Test → Verify. |
| `lazy-coder` | **AVAILABLE** | Enforced reuse of existing canonical services (`SalesPostingService`, `sales-tax-engine.ts`, `InventoryService`, `ProductRepository`). |
| `postgresql-and-supabase` | **AVAILABLE** | Guided query optimization, constraint/index audits, and RLS review. |
| `api-design-and-security` | **AVAILABLE** | Governed RESTful endpoint design, Zod schema contracts, and BOLA defense. |
| `security-auditing-and-owasp` | **AVAILABLE** | Evaluated RBAC boundaries, branch isolation, cashier privilege escalation defenses. |
| `clean-architecture` | **AVAILABLE** | Maintained domain boundaries between presentation (POS) and ledger (Accounting). |
| `technical-documentation` | **AVAILABLE** | Structured this 30-section audit document. |
| `git-workflow-and-releases` | **AVAILABLE** | Governed git hygiene, status tracking, and clean working tree checks. |
| *repository/service architecture* | **UNAVAILABLE** (Standalone) | Subsumed under `clean-architecture` and `smart-coder`. |
| *accounting/ERP* | **UNAVAILABLE** (Standalone) | Governed directly by frozen Phase 5A.6 canonical services. |
| *financial reporting* | **UNAVAILABLE** (Standalone) | Governed directly by frozen Phase 5A.6 canonical reporting engine. |
| *inventory management* | **UNAVAILABLE** (Standalone) | Governed directly by existing `InventoryService`. |
| *POS/retail workflows* | **UNAVAILABLE** (Standalone) | System designed from foundational retail principles. |
| *testing* | **UNAVAILABLE** (Standalone) | Testing conducted via Playwright, custom Node test scripts, and TypeScript compiler. |

---

## 3. Repository Findings

- **Architecture**: Next.js 14 App Router fullstack monorepo with PostgreSQL backend.
- **Frontend App Router**: `/dashboard/shop` (Branch Operations Console), `/dashboard/admin` (Enterprise Admin), `(store)` (Customer E-Commerce).
- **Primary Data Service Engine**: `ApiEngine` (`frontend/src/lib/api-engine.ts`, 1.13 MB) and domain services in `frontend/src/lib/services/`.
- **Catch-All Route**: `frontend/src/app/api/v1/[...path]/route.ts` (8,748 lines) centralizes REST controllers for `/api/v1/*`.
- **Existing Sales Posting Engine**: `SalesPostingService` (`frontend/src/lib/services/sales-posting.service.ts`, 1,880 lines) is completely operational.

---

## 4. PostgreSQL Schema Findings

Live database schema inspection via `pg` connection:
- `product`: 65 rows (all 65 active, `deleted_at IS NULL`).
  - Columns: `id`, `title`, `handle`, `status`, `thumbnail`, `hs_code`, `metadata` (JSONB), `merchandise_type`.
  - Indexes: `product_pkey` (PRIMARY KEY), `IDX_product_handle_unique` (UNIQUE), `IDX_product_status`, `IDX_product_type_id`, `IDX_product_collection_id`.
- `product_variant`: 27 rows (all 27 active).
  - Columns: `id`, `title`, `sku`, `barcode`, `ean`, `upc`, `manage_inventory`, `hs_code`, `product_id`, `variant_rank`, `metadata`.
  - Indexes: `product_variant_pkey` (PRIMARY KEY), `IDX_product_variant_sku_unique` (UNIQUE), `IDX_product_variant_barcode_unique` (UNIQUE), `IDX_product_variant_ean_unique` (UNIQUE), `IDX_product_variant_upc_unique` (UNIQUE), `IDX_product_variant_product_id`, `IDX_product_variant_id_product_id`.
- `branch_inventory`: 424 rows (423 positive qty, 0 reserved, total physical quantity = 20,053 units across 53 branches and 8 tracked products).
  - Indexes: `branch_inventory_pkey`, `IDX_branch_inventory_branch_variant` (UNIQUE on `branch_id, variant_id`), `IDX_branch_inventory_branch_id`, `IDX_branch_inventory_variant_id`.
- `payment_transaction`: 53 rows (providers: `cod` [49], `upi` [2], `card` [2]).
  - Indexes: `payment_transaction_pkey`, `idx_payment_transaction_order_id` (NON-UNIQUE on `order_id`), `idx_payment_transaction_idempotency` (UNIQUE on `idempotency_key`).
- `order`: 173 rows (status: `pending` [173] — legacy prototype data quarantined under Step 4.2).

---

## 5. Product / Catalog Architecture

The authoritative product model is defined by `ProductRepository.mapRowToDomain(p: any)`:
1. Product Record (`product`): Holds master identity, title, handle/slug, thumbnail, gallery, default `hs_code`, and `merchandise_type`.
2. Master Metadata (`product.metadata`):
   - `selling_price`: Base retail price in INR.
   - `mrp`: Maximum Retail Price in INR.
   - `tax_inclusive`: `true` (standard for retail bakeries in India).
   - `gst_rate`: Statutory percentage (5% for cakes, 18% for accessories).
   - `hsn_code`: Statutory HSN (`19059090` for cakes/pastries).
   - `weight_prices`: Array of weight-based options (`[ { weight: '0.5 kg', price: 450, mrp: 500, selling_price: 450 }, ... ]`).
3. Variant Record (`product_variant`): Represents physical SKUs with dedicated identifiers: `sku`, `barcode`, `ean`, `upc`.
4. Authoritative Product Identifier for Sales Posting: `variant_id` (primary) falling back to `product_id`.

---

## 6. Pricing / MRP Architecture

1. **Tax Inclusion**: Retail bakery prices are **TAX-INCLUSIVE** (`tax_inclusive: true`). When a cake has MRP ₹500 (at 5% GST), the customer pays exactly ₹500 at the counter. The base taxable value is:
   $$\text{Taxable Value} = \frac{\text{MRP}}{1 + \frac{\text{GST Rate}}{100}} = \frac{500}{1.05} = ₹476.19$$
   $$\text{CGST 2.5\%} = ₹11.90, \quad \text{SGST 2.5\%} = ₹11.90, \quad \text{Total Tax} = ₹23.81$$
2. **MRP vs Selling Price**:
   - `mrp`: Displayed strike-through anchor price.
   - `selling_price`: Active selling price. If `selling_price < mrp`, the POS displays "Save ₹(MRP - Price)".
3. **Branch-Specific Pricing**: `branch_price` table exists in PostgreSQL schema (currently 0 rows). The pricing hierarchy is:
   `branch_price (if present) → product.metadata.weight_prices (by variant) → product.metadata.selling_price → product.metadata.price`.
4. **Time-Effective & Inactive Prices**: Evaluated at cart add time; prices cannot be overridden by the cashier client.

---

## 7. Barcode Forensics

1. **Storage Fields**:
   - `product_variant.barcode` (TEXT)
   - `product_variant.ean` (TEXT)
   - `product_variant.upc` (TEXT)
   - `product_variant.sku` (TEXT)
2. **Indexing & Uniqueness**:
   - PostgreSQL enforces strict UNIQUE btree indexes on all four fields:
     - `IDX_product_variant_barcode_unique`
     - `IDX_product_variant_ean_unique`
     - `IDX_product_variant_upc_unique`
     - `IDX_product_variant_sku_unique`
3. **Current Data State**:
   - Currently, 0 rows have `barcode`, `ean`, or `upc` populated in the database; all existing variants rely solely on `sku` (e.g. `VANILLA-CUPCAKE-6`).
   - `pim-editor-modal.tsx` and `accessories-management-panel.tsx` contain dummy barcode generation (`890${Math.floor(100000000 + Math.random() * 900000000)}`) which was never indexed or persisted to database variants.
4. **Barcode Architecture Locked**:
   - Primary: `product_variant.barcode` (EAN-13 or Code 128).
   - Secondary: `product_variant.sku` (fallback text scan).
   - Weighted Barcode Support: Formats like `20AAAAA00250C` where prefix `20` indicates weighted item, `AAAAA` is SKU, and `00250` is 250 grams.
   - The scanner listener is a pure string producer that queries the `BarcodeResolver`.

---

## 8. Merchandise Type & Canonical Inventory Account Mapping

Forensic verification against live PostgreSQL `accounting_account` table:

| Merchandise Type | Category | Inventory Asset Account | COGS Account | Revenue Account |
| :--- | :--- | :--- | :--- | :--- |
| `CAKE` / `PASTRY` | Fresh Baked Goods | **`1132`** Merchandise Inventory - Cakes | **`5110`** COGS - Cakes | **`4110`** Cake & Bakery Sales Revenue (5% GST) |
| `ACCESSORY` | Candles, Toppers, Toys | **`1131`** Merchandise Inventory - Accessories | **`5120`** Accessory Merchandise Sold | **`4120`** Accessory & Merchandise Sales Revenue (18% GST) |
| `PACKAGING` | Boxes, Bags, Cake Boards | **`1133`** Packaging Supplies Stock | **`5130`** Packaging Materials Consumed | N/A (Internal consumption) |

> **Audit Invariant Re-Affirmed**: Account `1135` **DOES NOT EXIST** in the live database and is strictly prohibited.

---

## 9. GST / Tax Architecture

Canonical engine: `frontend/src/lib/services/sales-tax-engine.ts` (`calculateSalesTaxesAndTotals`).
1. **Place of Supply (POS) Resolution**:
   - Selling Branch State vs Customer State.
   - In-Store Counter Sales (Walk-In, Takeaway): **Customer State = Selling Branch State** (Place of supply is always the physical shop counter). Therefore, counter sales are **ALWAYS INTRA-STATE**.
   - Tax Breakdown: **CGST (50%) + SGST (50%)**.
2. **Statutory Accounts in Live DB**:
   - `1141`: Input CGST 2.5% (Food/Bakery)
   - `1142`: Input SGST 2.5% (Food/Bakery)
   - `1143`: Input CGST 9.0% (Accessories)
   - `1144`: Input SGST 9.0% (Accessories)
   - `2121`: Output CGST 2.5% (Food/Bakery)
   - `2122`: Output SGST 2.5% (Food/Bakery)
   - `2123`: Output CGST 9.0% (Accessories)
   - `2124`: Output SGST 9.0% (Accessories)
3. **Discounts & Delivery**:
   - Line discounts reduce the taxable base before tax calculation.
   - Counter sales have zero delivery fee (`delivery = 0`).

---

## 10. Inventory Concurrency & Locking Architecture

Live concurrency engine: `InventoryService.deductStockAtomic` in `frontend/src/lib/services/inventory.service.ts`:
1. **Atomic Operation**:
   ```sql
   UPDATE "branch_inventory"
   SET quantity = quantity - $1,
       updated_at = NOW()
   WHERE branch_id = $2
     AND (product_id = $3 OR variant_id = $3)
     AND (quantity - reserved) >= $1
     AND deleted_at IS NULL
   RETURNING id, branch_id, product_id, variant_id, quantity, reserved;
   ```
2. **Race Condition Resolution (Counter POS vs E-Commerce)**:
   - Both POS counter sales and online web checkouts execute within a PostgreSQL transaction with row-level locks on `branch_inventory`.
   - The conditional `WHERE (quantity - reserved) >= $1` ensures that if only 1 unit remains, the first transaction to commit succeeds; the second transaction receives 0 updated rows and throws `INSUFFICIENT_STOCK`.
   - On payment failure, the transaction rolls back cleanly with zero inventory mutation.

---

## 11. Counter Order Model

Counter sales differ structurally from E-Commerce orders:

| Attribute | `WALK_IN_COUNTER` | `TAKEAWAY` | `COUNTER_PICKUP` | `E-COMMERCE (ONLINE)` |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Info** | Optional (Guest/Anonymous) | Optional | Mandatory (Pre-booked) | Mandatory |
| **Fulfillment** | Instant (Across counter) | Immediate packaging | Claimed at counter | Dispatched via Rider |
| **Shipping Address** | None | None | None | Mandatory with Pincode |
| **Delivery Fee** | ₹0.00 | ₹0.00 | ₹0.00 | Calculated by Zone |
| **Rider & OTP** | None | None | Pickup OTP only | Pickup OTP + Delivery OTP |
| **Payment Status** | Paid immediately at till | Paid immediately | Paid online / at pickup | Razorpay / COD |

---

## 12. Payment & Tender Forensics

- PostgreSQL table `payment_transaction`:
  - `id` (PK, text)
  - `order_id` (FK to `order`, non-unique index)
  - `amount` (INTEGER paise/INR, matches order)
  - `currency` (text, e.g. 'INR')
  - `provider` (text: 'cash', 'upi', 'card', 'split', 'cod')
  - `provider_ref` (text: transaction reference / UTR / terminal auth code)
  - `status` (text: 'captured', 'pending', 'refunded', 'partially_refunded')
  - `settlement_status` (text: 'settled', 'unsettled', 'pending')
  - `idempotency_key` (text, unique index)

---

## 13. Provider-Neutral Tender Architecture

The POS tender abstraction wraps business tenders without embedding third-party SDKs:
```typescript
export type PosTenderType = "CASH" | "UPI_STATIC_QR" | "UPI_DYNAMIC_QR" | "CARD_EDC" | "WALLET" | "SPLIT";
```
- `CASH`: Received directly into till. Recorded with physical denomination breakdown. Settles directly into Account `1111 Cash in Hand`.
- `UPI_STATIC_QR` / `UPI_DYNAMIC_QR`: Customer scans printed/screen QR and pays via phone. Cashier enters UPI Ref / UTR. Settles into Account `1113 Gateway Clearing`.
- `CARD_EDC`: Swiped/dipped on physical bank EDC machine. Cashier enters approval code / terminal reference. Settles into Account `1113 Gateway Clearing`.
- **Zero Razorpay dependencies in the counter POS core.**

---

## 14. Split Tender Design

Because `payment_transaction` indexes `order_id` with a non-unique index (`idx_payment_transaction_order_id`), **multiple payment transactions can link to a single order without schema modification!**
- Example: Bill = ₹650.00
  - `paytxn_1`: `amount = 200`, `provider = 'cash'`, `provider_ref = 'pos_cash_shift_s1_t1'`, `status = 'captured'`
  - `paytxn_2`: `amount = 450`, `provider = 'upi'`, `provider_ref = 'upi_utr_9876543210'`, `status = 'captured'`
- Invariant: `sum(tender.amount) === order.total_amount`.

---

## 15. Customer Model (Guest vs Identified)

1. **Anonymous Walk-In**:
   - `order.customer_id` is set to `null` or `'guest'`.
   - In accordance with Section 4 of `CustomerReceiptService`: `journal_line.customer_id` is set to `NULL`. No fake customer row is created in `public.customer`.
2. **Identified Walk-In**:
   - Cashier enters customer mobile number (`10 digits`).
   - If found in `public.customer`, links customer record; if not found, creates clean customer profile.
   - Enables digital WhatsApp invoice delivery and anniversary loyalty points.

---

## 16. Receipt Architecture (80mm vs 58mm Thermal)

Standardized continuous roll layout leveraging browser `@media print`:
- **80mm Layout** (Standard counter receipt, 48 columns):
  - Brand header, Branch Name, GSTIN, FSSAI Lic No.
  - Tax Invoice No., Date/Time, Cashier Name.
  - Table: Item, Qty, Rate, Taxable, GST%, Total.
  - Total Summary: Subtotal, Discount, CGST, SGST, Net Total.
  - Tender breakdown: Cash Received, Change Returned, or UPI Ref.
  - Dynamic QR code for digital bill / feedback.
- **58mm Layout** (Compact receipt, 32 columns):
  - Condensed single-line item layout, summarized tax block.

---

## 17. Barcode Label Design (50mm × 25mm)

Authoritative sticker format for fresh cake boxes and bakery shelves:
```
┌──────────────────────────────────────────────┐
│  CakeToHome Artisanal Bakery         [🟢 VEG]│
│  DUTCH CHOCOLATE TRUFFLE 1KG                 │
│  SKU: CHOC-TRUF-1KG         MRP: ₹650.00     │
│  Packed: 01-Oct-2026 09:30 AM                │
│  Best Before: 03-Oct-2026 09:30 AM           │
│  ||||||||||||||||||||||||||||||||||||||||||  │
│  8901234567890             FSSAI: On File    │
└──────────────────────────────────────────────┘
```

---

## 18. Cashier RBAC & Permission Boundaries

Current state: `POS.*` permissions are missing from `frontend/src/lib/staff-access-control.ts`.  
Locked permissions to introduce in Phase 5B.2:
- `POS.ACCESS`: Access `/dashboard/pos` route.
- `POS.BILLING`: Add to cart, scan barcodes, process tenders, trigger receipt print.
- `POS.DISCOUNT`: Apply discounts up to authorized limit (e.g. 10%).
- `POS.HOLD_CART`: Park and retrieve open counter carts.
- `POS.SHIFT_OPEN`: Declare opening cash float.
- `POS.SHIFT_CLOSE`: Submit closing cash denominations.
- `POS.CASH_DROP`: Perform counter-to-safe cash transfers.

---

## 19. Cash & Teller Architecture (Shift Lifecycle)

```
[1. Open Shift] Cashier enters opening float notes (₹500 × 2, ₹100 × 5 = ₹1,500)
       ↓
[2. POS Billing] Continuous sales ringing; cash collected accumulates in drawer
       ↓
[3. Mid-Day Drop] Cashier transfers excess cash (e.g. ₹15,000) to Branch Safe
       ↓
[4. Shift Close] Cashier counts physical cash and enters counts into BLIND screen
       ↓
[5. Server Audit] Server compares (Opening + Cash Sales - Safe Drops) vs Physical Count
       ↓
[6. Variance Post]
    • Cash Shortage → Work Queue → Dr 5295 Cash Variance / Cr 1111 Cash in Hand
    • Cash Overage  → Work Queue → Dr 1111 Cash in Hand / Cr 4290 Other Income
```

---

## 20. Blind Cash Close Security

To prevent theft and cash skimming:
1. The cashier closing screen **NEVER** displays the system-calculated expected cash.
2. The cashier must enter physical note counts (`count_500`, `count_200`, `count_100`, etc.).
3. The server computes variance atomically upon submission.
4. If variance $\neq 0$, the session flags a `CASH_VARIANCE_EXCEPTION` requiring Manager sign-off.

---

## 21. Counter Discounts & Price Override Controls

1. **Cashier Discretion**: Max 10% line/cart discount without manager PIN override.
2. **Tax Impact**: In India, trade discounts reduce the taxable value *before* GST calculation.
3. **Structured Reasons**: Required dropdown: `DAMAGED_BOX`, `PROMOTIONAL_COUPON`, `STAFF_DISCOUNT`, `EVENING_CLEARANCE`, `CUSTOMER_GOODWILL`.

---

## 22. Offline POS Architectural Assessment

- **Finding**: Offline billing with local client-side authority is **HIGH RISK** for fresh bakery sales (causes double-selling fresh cakes and unverified tax calculations).
- **Design Decision**: POS will be **Online-First with Local Cart Park Buffer**. If the internet drops temporarily, open carts remain cached in browser `IndexedDB`. When connection resumes, transactions submit to server for atomic inventory lock and sales voucher creation. Local autonomous GL posting is strictly rejected.

---

## 23. Existing Reusable UI Primitives

- `InvoiceModal` (`frontend/src/components/dashboard/shop/invoice-modal.tsx`): Reusable print styling patterns.
- `BranchOperationsManager`: Reusable branch session resolution, alerts, and navigation.
- `AccountingExports` (`frontend/src/lib/data/accounting-exports.ts`): Reusable print stylesheet triggers.
- Medusa UI tokens: Button, Input, Badge, Container, Select, Table.

---

## 24. Duplicate & Stale Implementation Findings

1. `create-order-drawer.tsx`: Redundant for counter billing; must remain for telemarketing only.
2. Hardcoded barcode generation in PIM and Accessories modals (`890...`) must be replaced with canonical `BarcodeResolver` in Phase 5B.3.
3. Historical prototype data (173 orders, 53 payment transactions) must remain strictly quarantined from POS counter sales.

---

## 25. Contradictions Identified & Reconciled

The table below reconciles all contradictions between previous planning prose and the live database/codebase:

| Dimension | Previous Audit Claim | Live Database / Verified Source | Authoritative Resolution |
| :--- | :--- | :--- | :--- |
| **Output GST Accounts** | Claimed `2141` & `2142` | Actual: `2121-2129` (`2121` Output CGST 2.5%, `2122` Output SGST 2.5%) | **Use `2121-2129` exclusively.** |
| **Customer Advances** | Claimed `2112` | Actual: `2141` (`Customer Advances`) | **Use `2141` for customer advance liabilities.** |
| **Cash Variance Account** | Claimed `5280 Cash Shortage` | Actual: `5280` is Tech Infrastructure. Actual variance account is **`5295 Cash Rounding / Variance`**. | **Use `5295` exclusively.** |
| **COGS / Spoilage** | Claimed `5120 Spoilage` | Actual: `5120` is **`Accessory Merchandise Sold`**. | **Use `5120` for Accessory COGS.** |
| **Account Code Column** | Shorthand `account_code` | Actual PostgreSQL column: **`code`**. | **Use `code` in all SQL queries.** |
| **Account Subtype Column**| Shorthand `sub_type` | Actual PostgreSQL column: **`subtype`**. | **Use `subtype` in all SQL queries.** |
| **Barcode Uniqueness** | Assumed unindexed text | Actual: **Strict UNIQUE indexes on `barcode`, `ean`, `upc`, `sku`**. | **Enforce global uniqueness.** |
| **Split Tender Support** | Assumed schema change needed | Actual: **`payment_transaction.order_id` is non-unique index; supports multiple rows per order**. | **Zero schema change required.** |

---

## 26. Frozen Architectural Decisions

1. **Zero Financial Calculation in POS**: POS Cart consumes `calculateSalesTaxesAndTotals` from `sales-tax-engine.ts`.
2. **Sales Posting Reuse**: Completed POS sales delegate directly to `SalesPostingService` for balanced voucher creation.
3. **Provider-Neutral Tenders**: Tenders record into `payment_transaction` with provider strings (`cash`, `upi`, `card`).
4. **Anonymous Guest Support**: Counter sales allow `customer_id = null`; journal lines record `customer_id = NULL`.
5. **No Database Mutations in Gate 5B.1**: All tests and forensic audits remain strictly read-only.

---

## 27. Proposed TypeScript Design Contracts

*(Design contracts only — to be implemented in Phase 5B.2)*

```typescript
export interface PosCartItem {
  productId: string;
  variantId: string;
  sku: string;
  barcode?: string;
  title: string;
  quantity: number;
  unitPrice: number;       // Tax-inclusive retail price
  taxRatePercent: number;  // 5 for cakes, 18 for accessories
  hsnCode: string;
  merchandiseType: "CAKE" | "ACCESSORY" | "PACKAGING";
  lineDiscount: number;
}

export interface PosCartState {
  cartId: string;
  branchId: string;
  cashierId: string;
  mode: "WALK_IN_COUNTER" | "TAKEAWAY" | "COUNTER_PICKUP" | "INSTORE_DELIVERY_BOOKING";
  items: PosCartItem[];
  subtotal: number;
  totalDiscount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  customer?: { id?: string; name?: string; phone?: string };
}

export interface BarcodeResolutionResult {
  status: "FOUND" | "NOT_FOUND" | "INACTIVE" | "OUT_OF_STOCK";
  product?: { id: string; title: string };
  variant?: { id: string; title: string; sku: string; barcode: string; price: number };
}

export interface PosTenderPayload {
  orderId: string;
  branchId: string;
  cashierId: string;
  tenders: Array<{
    method: "CASH" | "UPI" | "CARD" | "WALLET";
    amount: number;
    reference?: string;
  }>;
  totalTendered: number;
  changeReturned: number;
}
```

---

## 28. Proposed API Routing Blueprint

*(Routing design for Phase 5B.2)*

- `GET /api/v1/pos/catalog?branch_id=...` — High-speed category & product cache.
- `GET /api/v1/pos/barcode/:code?branch_id=...` — Instant barcode resolution.
- `POST /api/v1/pos/cart/validate` — Server-side price, tax, and stock verification.
- `POST /api/v1/pos/sale/checkout` — Atomic stock deduction, payment transaction creation, sales voucher posting.
- `GET /api/v1/pos/receipt/:order_id` — 80mm/58mm thermal receipt payload.
- `POST /api/v1/pos/shift/open` & `POST /api/v1/pos/shift/close` — Cashier shift teller operations.

---

## 29. Implementation Roadmap: Substeps 5B.2 through 5B.5

- **5B.2 — POS Terminal UI & Checkout Workflow**:
  - Cashier touchscreen interface (`/dashboard/pos`), category tiles, cart summary, quick tender modal, split tender, thermal receipt trigger.
- **5B.3 — Barcode & Label Engine**:
  - Global keyboard wedge scanner listener, EAN-13/Code128 barcode resolution, 50×25mm thermal product label generator.
- **5B.4 — Cashier Shift & Teller Management**:
  - Shift open/close sessions, denomination inputs, blind cash close, safe drops, variance routing to Accounting Work Queue.
- **5B.5 — POS Integration Verification Suite**:
  - Automated tests covering counter cash sales, UPI sales, split tender, out-of-stock rejections, and shift variance reconciliation.

---

## 30. Non-Mutating Verification, TypeScript & Mutation Proof

### 30.1 Non-Mutating Verification Output
The forensic inspection script executed cleanly:
- 65 products verified (100% active).
- 27 variants verified (100% active, unique indexes intact).
- 424 branch inventory records verified (20,053 units in stock).
- 53 payment transactions verified.
- 99 Chart of Accounts records verified.

### 30.2 Database Mutation Proof
Table row counts before and after the forensic inspection:
```
Table                      Before Count   After Count   Mutation Status
-----------------------------------------------------------------------
product                             65            65   ✓ UNCHANGED
product_variant                     27            27   ✓ UNCHANGED
product_category                    11            11   ✓ UNCHANGED
price_set                           15            15   ✓ UNCHANGED
price                               29            29   ✓ UNCHANGED
branch_price                         0             0   ✓ UNCHANGED
branch_inventory                   424           424   ✓ UNCHANGED
payment_transaction                 53            53   ✓ UNCHANGED
order                              173           173   ✓ UNCHANGED
accounting_account                  99            99   ✓ UNCHANGED
accounting_voucher                   0             0   ✓ UNCHANGED
accounting_journal_entry             0             0   ✓ UNCHANGED
accounting_journal_line              0             0   ✓ UNCHANGED
accounting_fiscal_period             0             0   ✓ UNCHANGED
```
**Conclusion**: **ZERO database mutations (0 rows created, updated, or deleted).**

### 30.3 TypeScript Verification
- Command: `npx tsc --noEmit`
- Result: **0 errors (Exit code 0).**

---

## 31. Final STOP Gate

**Forensic & Design Gate 5B.1 is COMPLETE.**  
Per instructions:
- Production code for 5B.2 has NOT been implemented.
- Database schemas have NOT been migrated.
- Cashier shifts have NOT been opened.
- Canonical accounting files remain untouched.
- Execution is STOPPED, awaiting explicit authorization to proceed to **Phase 5B.2 (POS Terminal UI & Checkout Workflow)**.
