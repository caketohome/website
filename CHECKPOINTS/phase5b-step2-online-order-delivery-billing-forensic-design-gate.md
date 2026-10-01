# Phase 5B.2 — Online Order → Delivery → Final Billing — Forensic & Design Gate
## Comprehensive Architectural Lock & Non-Mutating Verification

> **Document ID**: `CHECKPOINTS/phase5b-step2-online-order-delivery-billing-forensic-design-gate.md`  
> **Status**: `FORENSIC & DESIGN GATE LOCKED — IMPLEMENTATION STOP APPLIED`  
> **Milestone**: Phase 5B.2 (Online Order → Delivery → Final Billing)  
> **Baseline Integrity**: Zero PostgreSQL mutations detected; 0 TypeScript errors (`npx tsc --noEmit` exit 0).  
> **Authoritative Invariant**: **PostgreSQL Schema + Canonical Services + Live Source Code > Planning Prose.**  
> **Critical Business Correction**: The previous retail/counter POS assumption (walk-in customers, counter billing, barcode scanning for cakes) is **REJECTED AND OBSOLETE**. CakeToHome is 100% online-order-only.

---

## 1. Executive Summary

Phase 5B.1 (POS + Barcode Forensic Design Gate) established the architectural baseline for shop-counter operations. **However, the fundamental business model has been corrected:**

- CakeToHome is **100% online-order-only** — there are no walk-in counter sales.
- Cakes are **made live / on demand**, with production toggled on/off.
- **Barcode scanning is NOT required for cakes** (optional later for stocked accessories/packaging only).
- **Order ≠ Bill**: An online order progresses through its operational lifecycle. The **DELIVERED** status is the sole idempotent trigger that converts the order into a **FINAL TAX INVOICE** exactly once.

This gate (5B.2) performs a comprehensive forensic inspection of the live system's order lifecycle, delivery chain, payment infrastructure, and accounting integration to establish the authoritative contracts for Phase 5B.3 implementation.

---

## 2. Skills Available / Unavailable Report

| Skill | Status | Utilization in 5B.2 |
| :--- | :--- | :--- |
| `smart-coder` | **AVAILABLE** | Guided forensic inspection lifecycle |
| `lazy-coder` | **AVAILABLE** | Enforced reuse of existing canonical services |
| `postgresql-and-supabase` | **AVAILABLE** | Live database schema/constraint/enum audits |
| `api-design-and-security` | **AVAILABLE** | Evaluated API contract integrity |
| `security-auditing-and-owasp` | **AVAILABLE** | RBAC/authorization boundary evaluation |
| `clean-architecture` | **AVAILABLE** | Domain boundary preservation between operations and accounting |
| `technical-documentation` | **AVAILABLE** | Structured this checkpoint document |
| `git-workflow-and-releases` | **AVAILABLE** | Git status verification |
| *POS/retail workflows* | **N/A** | Counter POS concept is **REJECTED** |
| *barcode/thermal printing* | **N/A** | Not required for cakes |

---

## 3. Critical Architectural Flaw: Premature Invoice Generation

### Root Cause

In [`api-engine.ts` line 23629](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts#L23629):

```typescript
const invoiceNumber = `CTH/26-27/${String(orderSeq).padStart(6, "0")}`;
```

This generates and assigns `invoice_number` at **order creation time** (line 23685), immediately during checkout — violating the core business invariant **Order ≠ Bill**.

### Current Behavior (WRONG)
```
Customer clicks "Place Order"
    → ApiEngine.createOrderBackend()
    → invoiceNumber = "CTH/26-27/000101"     ← PREMATURE
    → order.invoice_number = invoiceNumber     ← WRONG: Order is not yet delivered
    → order.status = "pending"
```

### Required Behavior (5B.3 Design)
```
Customer clicks "Place Order"
    → Order created with order_number only
    → invoice_number = NULL
    → Order lifecycle: CREATED → CONFIRMED → KITCHEN_ACCEPTED → PREPARING
                       → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED
    
DELIVERED transition (Customer Delivery OTP verified):
    → Atomically allocate statutory invoice_number
    → Generate immutable Final Bill / Tax Invoice DTO
    → Call SalesPostingService to recognize revenue + COGS
    → Idempotent: re-verification returns existing invoice
```

---

## 4. Order Lifecycle: Live State Machine

From [`order-lifecycle-service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/order-lifecycle-service.ts) lines 80-93:

### Canonical State Transitions
```
CREATED → PAYMENT_PENDING | CONFIRMED | CANCELLED | FAILED
PAYMENT_PENDING → CONFIRMED | CANCELLED | FAILED
CONFIRMED → KITCHEN_ACCEPTED | PREPARING | READY_FOR_PICKUP | CANCELLED
KITCHEN_ACCEPTED → PREPARING | READY_FOR_PICKUP | CANCELLED
PREPARING → READY_FOR_PICKUP | CANCELLED
READY_FOR_PICKUP → OUT_FOR_DELIVERY | CANCELLED
OUT_FOR_DELIVERY → DELIVERED | READY_FOR_PICKUP | CANCELLED
DELIVERED → REFUNDED                    ← Terminal (except refund)
CANCELLED → REFUNDED
REFUNDED → []                           ← Absolute terminal
```

### Delivery Lifecycle States
```
pending → shop_accepted → pickup_claimed → shop_preparing → ready_for_pickup
→ in_transit → delivered | delivery_exception | cancelled
```

### DELIVERED Transition Implementation (Lines 492-568)
Currently:
1. ✅ Verifies Customer Delivery OTP at doorstep
2. ✅ Sets `order.status = "delivered"`, `order.delivered_at = now`
3. ✅ Updates delivery partner workload counters
4. ✅ Emits `order.delivered` outbox event via WebhookEngine
5. ❌ **Does NOT allocate statutory invoice_number**
6. ❌ **Does NOT generate Final Bill / Tax Invoice DTO**
7. ❌ **Does NOT call SalesPostingService**
8. ❌ **Does NOT post revenue recognition or COGS**

### Role-Based Access Control
| Actor | Allowed Transitions |
|-------|-------------------|
| CUSTOMER | CONFIRMED → CANCELLED only |
| BRANCH_MANAGER | Cannot trigger OUT_FOR_DELIVERY or DELIVERED |
| DELIVERY_PARTNER | OUT_FOR_DELIVERY, DELIVERED, PREPARING, READY_FOR_PICKUP |
| SUPER_ADMIN | All transitions |
| SYSTEM | All transitions |

---

## 5. PostgreSQL Schema: Live Database Truth

### 5.1 `public.order` Table (173 rows, all status: `pending`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | PK |
| `status` | `order_status_enum` | Enum: `pending, completed, draft, archived, canceled, requires_action` |
| `metadata` | jsonb | Contains: items, delivery, branch_id, customer_uid, total_amount, bakery_status, payment_method, payment_status, delivery_date, delivery_slot_id, delivery_zone_id |
| `display_id` | integer | Auto-increment sequence |
| `custom_display_id` | text | Custom display ID |
| `customer_id` | text | FK to customer |

**Critical Gap**: The PostgreSQL `order_status_enum` has only 6 values: `pending, completed, draft, archived, canceled, requires_action`. The full operational lifecycle (KITCHEN_ACCEPTED, PREPARING, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED) is currently managed **in-memory via the metadata JSONB and the OrderLifecycleService** — not as native enum values.

**Missing Columns**: No native `invoice_number`, `delivered_at`, `delivery_status`, `payment_status`, `bakery_status` columns. These are currently tracked inside `metadata` JSONB or in-memory.

### 5.2 `public.delivery` Table (57 rows)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | PK |
| `delivery_status` | text | Not enum |
| `delivery_partner_id` | text | FK |
| `delivered_at` | timestamptz | Nullable |
| `delivery_otp` | text | For customer verification |
| `recipient_name/phone/address` | text | Delivery recipient |
| `gift_wrap`, `greeting_card`, `gift_message` | boolean/text | Gift options |
| `anonymous_delivery`, `hide_invoice` | boolean | Privacy options |
| `is_surprise_delivery` | boolean | Surprise flag |
| `scheduled_delivery_at`, `scheduled_slot` | timestamptz/text | Scheduling |

### 5.3 `public.delivery_partner` Table (30 rows)

| Column | Type |
|--------|------|
| `id` | text |
| `first_name`, `last_name` | text |
| `email`, `phone` | text |

### 5.4 `public.delivery_proof` Table (0 rows)

| Column | Type | Notes |
|--------|------|-------|
| `order_id` | text | FK |
| `delivery_id` | text | FK |
| `delivery_partner_id` | text | FK |
| `photo_url`, `signature_url` | text | Proof of delivery |
| `latitude`, `longitude` | numeric | GPS at delivery |
| `captured_at` | timestamptz | When proof was captured |

### 5.5 `public.payment_transaction` Table (53 rows)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | PK |
| `order_id` | text | Non-unique FK (supports split payments) |
| `provider` | text | `cod` (49), `upi` (2), `card` (2) |
| `amount` | integer | In smallest currency unit |
| `status` | text | `pending`, `partially_refunded`, `refunded` |
| `settlement_status` | text | Gateway settlement tracking |
| `idempotency_key` | text | Unique (prevents duplicate charges) |

### 5.6 Production/Recipe/BOM/Ingredient Tables

**NONE EXIST.** Zero production tables in the database. Cakes are made-to-order with no recipe/BOM tracking infrastructure. This confirms that:
- Cakes don't undergo warehouse picking or barcode scanning
- Production workflow (5C) must be designed from scratch
- Products are classified by `merchandise_type: CAKE | ACCESSORY | PACKAGING`

### 5.7 Invoice Tables

**NONE EXIST.** There is no dedicated `invoice` or `bill` table. Invoice generation is currently premature (at order creation in ApiEngine) and stored only as an `invoice_number` field in the in-memory order object. The 5B.3 implementation must design the proper invoice persistence model.

---

## 6. Authoritative Accounting Accounts (Live PostgreSQL)

| Code | Name | Subtype | Status |
|------|------|---------|--------|
| **1111** | Cash in Hand | CASH | ✅ Active |
| **1112** | Bank Operating A/c | BANK | ✅ Active |
| **1113** | Gateway Clearing | GATEWAY_CLEARING | ✅ Active |
| **1118** | Deposit in Transit | CURRENT_ASSET | ✅ Active |
| **1121** | Accounts Receivable | RECEIVABLE | ✅ Active |
| **1131** | Merchandise Inventory - Accessories | INVENTORY | ✅ Active |
| **1132** | Merchandise Inventory - Cakes | INVENTORY | ✅ Active |
| **1133** | Packaging Supplies Stock | INVENTORY | ✅ Active |
| **2111** | Accounts Payable | PAYABLE | ✅ Active |
| **2121** | Output CGST 2.5% (Food/Bakery) | OUTPUT_TAX | ✅ Active |
| **2122** | Output SGST 2.5% (Food/Bakery) | OUTPUT_TAX | ✅ Active |
| **2123** | Output CGST 9.0% (Accessories) | OUTPUT_TAX | ✅ Active |
| **2124** | Output SGST 9.0% (Accessories) | OUTPUT_TAX | ✅ Active |
| **2125** | Output IGST 5.0% (Interstate Food) | OUTPUT_TAX | ✅ Active |
| **2126** | Output IGST 18.0% (Interstate Accessories) | OUTPUT_TAX | ✅ Active |
| **2127** | Output CGST 6.0% (Toys) | OUTPUT_TAX | ✅ Active |
| **2128** | Output SGST 6.0% (Toys) | OUTPUT_TAX | ✅ Active |
| **2129** | Output IGST 12.0% (Interstate Toys) | OUTPUT_TAX | ✅ Active |
| **2141** | Customer Advances | CUSTOMER_ADVANCE | ✅ Active |
| **4110** | Cake & Bakery Sales Revenue (5% GST) | DIRECT_REVENUE | ✅ Active |
| **4120** | Accessory & Merchandise Sales Revenue (18% GST) | DIRECT_REVENUE | ✅ Active |
| **4130** | Delivery & Shipping Charges Collected | DELIVERY_REVENUE | ✅ Active |
| **5110** | COGS - Cakes | COGS | ✅ Active |
| **5120** | Accessory Merchandise Sold | COGS | ✅ Active |
| **5130** | Packaging Materials Consumed | COGS | ✅ Active |
| **5290** | Payment Gateway MDR Fees | OPERATING_EXPENSE | ✅ Active |
| **5295** | Cash Rounding / Variance | OPERATING_EXPENSE | ✅ Active |

**Accounting Vouchers**: 0 rows (no vouchers posted yet — all 173 orders are legacy prototype data).

---

## 7. SalesPostingService Integration Points

[`SalesPostingService`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/sales-posting.service.ts) (1,880 lines) provides the complete accounting lifecycle:

### Available Methods (Frozen Phase 5A.6)
1. `inspectAndBuildJournalLines(orderId, client)` — Reads order from PostgreSQL, validates product/branch/customer, executes SalesTaxEngine, builds balanced journal lines
2. `createSalesVoucherDraft(params)` — Creates DRAFT voucher with SoD enforcement
3. `submitSalesVoucher(params)` — Transitions DRAFT → SUBMITTED
4. `approveSalesVoucher(params)` — Transitions SUBMITTED → APPROVED (preparer ≠ approver)
5. `postSalesVoucher(params)` — Atomically posts to GL with COGS recognition

### COGS Recognition (Lines 1681-1770)
```
Cakes:       Dr 5110 (COGS-Cakes)        / Cr 1132 (Cake Inventory)
Accessories: Dr 5120 (Accessory COGS)     / Cr 1131 (Accessory Inventory)
Packaging:   Dr 5130 (Packaging Consumed) / Cr 1133 (Packaging Stock)
```

### Revenue Recognition
```
Cakes:    Cr 4110 (Cake & Bakery Sales Revenue)
Accs:     Cr 4120 (Accessory & Merchandise Sales Revenue)
Delivery: Cr 4130 (Delivery & Shipping Charges Collected)
```

### GST Recognition
```
Intra-state: Cr 2121 CGST 2.5% + Cr 2122 SGST 2.5% (cakes)
             Cr 2123 CGST 9.0% + Cr 2124 SGST 9.0% (accessories)
Inter-state: Cr 2125 IGST 5.0% (cakes) / Cr 2126 IGST 18.0% (accessories)
```

### Guards
- Rejects legacy prototype orders (`metadata.legacy_prototype = true` OR `metadata.is_ledger_eligible ≠ true`)
- Validates branch ownership and activity status
- Requires valid GST rate on every product
- Requires resolvable customer delivery state for Place of Supply

---

## 8. Corrected Online Order → Delivery → Final Billing Flow

```
CUSTOMER ─────────────────────────────────────────────────────────────
    │
    ▼
ONLINE WEBSITE (Place Order)
    │
    ▼
ORDER CREATED ──── order_number: CTH-YYYYMMDD-NNN
    │                invoice_number: NULL (NOT allocated yet)
    │                status: CREATED / PAYMENT_PENDING
    │
    ▼
PAYMENT ──── Online (UPI/Card) → 2141 Customer Advances / 1113 Gateway Clearing
    │         COD → No advance entry (settled at delivery)
    │
    ▼
ORDER CONFIRMED ──── status: CONFIRMED
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAKE ORDER                              │ ACCESSORY ORDER       │
│ → KITCHEN_ACCEPTED                      │ → Pick from inventory │
│ → PREPARING (baking)                    │ → Pack                │
│ → READY_FOR_PICKUP (packed)             │ → READY_FOR_PICKUP    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
RIDER PICKUP ──── Pickup OTP verified at shop
    │              status: OUT_FOR_DELIVERY
    │
    ▼
RIDER AT DOORSTEP ──── Customer Delivery OTP verified
    │
    ▼
╔═══════════════════════════════════════════════════════════════════╗
║  DELIVERED (SOLE IDEMPOTENT INVOICING TRIGGER)                   ║
║                                                                   ║
║  Atomically:                                                      ║
║  1. order.status = 'delivered', order.delivered_at = now           ║
║  2. Allocate statutory invoice_number: CTH/YY-YY/NNNNNN           ║
║  3. Generate immutable Final Bill / Tax Invoice DTO                ║
║     ↳ Permanently linked to order_id + order_number                ║
║  4. Call SalesPostingService.createSalesVoucherDraft()              ║
║     → Recognize revenue: Cr 4110/4120/4130                         ║
║     → Recognize GST: Cr 2121-2129                                  ║
║     → Recognize COGS: Dr 5110/5120/5130 / Cr 1131/1132/1133       ║
║     → Clear advance/receivable: Dr 2141/1113/1111 / Cr 1121        ║
║  5. Enforce idempotency: re-verification returns existing invoice   ║
║     without duplicate voucher posting                               ║
╚═══════════════════════════════════════════════════════════════════╝
    │
    ▼
POST-DELIVERY (Optional)
    → Refund → SalesInvoiceReversalService
    → Return → CreditNoteService
    → Dispute → CustomerReceiptService adjustments
```

---

## 9. Payment Architecture Findings

### Providers in Live Data
| Provider | Count | Settlement Model |
|----------|-------|-----------------|
| COD | 49 | Cash collected at delivery → 1111 Cash in Hand |
| UPI | 2 | Gateway → 1113 Gateway Clearing → 1112 Bank Operating A/c |
| Card | 2 | Gateway → 1113 Gateway Clearing → 1112 Bank Operating A/c (minus MDR → 5290) |

### Split Payment Support
The `payment_transaction.order_id` index is **NON-UNIQUE**, natively supporting multiple transactions per order without schema changes.

### COD Flow for 5B.3
```
Order Created → payment_method: "cod", payment_status: "pending"
                No accounting entry yet
    
Delivered → Rider collects cash → payment_status: "paid"
         → Dr 1111 Cash in Hand / Cr 1121 Accounts Receivable
         → Revenue + COGS posting (see Section 8)
```

### Online Payment Flow for 5B.3
```
Order Created → Gateway captures payment
             → Dr 1113 Gateway Clearing / Cr 2141 Customer Advances

Delivered → Convert advance to revenue
         → Dr 2141 Customer Advances / Cr 4110/4120 Revenue + Cr 2121-2129 GST
         → COGS posting: Dr 5110/5120 / Cr 1132/1131
```

---

## 10. Customer Table (57 rows)

| Column | Type |
|--------|------|
| `id` | text (PK) |
| `first_name`, `last_name` | text |
| `email`, `phone` | text |
| `has_account` | boolean |
| `metadata` | jsonb |
| `created_by` | text |

Guest orders use `customer_id = NULL` in journal lines to avoid FK errors (verified in CustomerReceiptService).

---

## 11. Audit/Event Infrastructure

### `order_status_history` (94 rows)
Tracks from_status → to_status with actor_type, actor_id, reason, and metadata.

### `order_event` (13 rows)
Tracks event_type, message, actor_type, actor_id, with `is_customer_visible` flag.

### `delivery_proof` (0 rows)
Schema ready for photo_url, signature_url, GPS coordinates, and captured_at timestamp. Ready for implementation in 5B.3.

---

## 12. Cake vs Accessory Production Model

### Cakes (merchandise_type = 'CAKE')
- **Made-to-order**: No pre-stocking, no warehouse picking
- **No barcode scanning**: Cakes aren't scanned at any stage
- **Production lifecycle** (to be built in 5C):
  ```
  KITCHEN_ACCEPTED → PREPARING (Baking) → READY_FOR_PICKUP (Packed)
  ```
- **No recipe/BOM tables exist** — Production workflow must be designed from scratch
- **Inventory account**: 1132 (Merchandise Inventory - Cakes)
- **COGS account**: 5110 (COGS - Cakes)

### Accessories (merchandise_type = 'ACCESSORY')
- **Stocked**: Physical inventory tracked in `branch_inventory` (424 rows, 20,053 units)
- **Barcode optional**: `product_variant` has unique indexes on barcode, ean, upc, sku
- **Warehouse picking**: Standard pick-pack-ship workflow
- **Inventory account**: 1131 (Merchandise Inventory - Accessories)
- **COGS account**: 5120 (Accessory Merchandise Sold)

### Packaging (merchandise_type = 'PACKAGING')
- **Consumable**: Used during packing, not sold directly
- **Inventory account**: 1133 (Packaging Supplies Stock)
- **COGS account**: 5130 (Packaging Materials Consumed)

---

## 13. Implementation Roadmap: Corrected Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **5B.2** | **This Gate: Online Order → Delivery → Billing Forensic** | 🔒 **LOCKED** |
| **5B.3** | Online Order → Delivery → Final Billing Implementation | ⏸️ PENDING |
| **5C** | Cake Production Workflow (Recipe/BOM/Kitchen) | ⏸️ PENDING |
| **5D** | Accessory Barcode & Inventory (optional) | ⏸️ PENDING |
| **5E** | Delivery Partner App & GPS Tracking | ⏸️ PENDING |
| **5F** | Customer Notifications & Order Tracking UI | ⏸️ PENDING |
| **5G** | Reports & Analytics Dashboard | ⏸️ PENDING |

### 5B.3 Scope (Next Implementation Phase)
1. **Fix premature invoicing**: Remove invoice_number from order creation; set to NULL
2. **Delivery-triggers-invoice**: When DELIVERED, atomically allocate invoice_number and create Final Bill DTO
3. **Accounting bridge**: Wire `order.delivered` event to SalesPostingService
4. **Idempotency**: Ensure re-delivery-verification returns existing invoice without duplicate posting
5. **Invoice persistence**: Create proper invoice storage (DB table or immutable metadata)
6. **COD vs Online payment reconciliation**: Wire correct accounting entries per payment method
7. **Delivery proof capture**: Wire delivery_proof table for photo/signature/GPS

---

## 14. Non-Mutating Verification & Mutation Proof

### Pre/Post Row Counts (Identical — Zero Mutations)

| Table | Count |
|-------|-------|
| `order` | 173 |
| `order_item` | 0 |
| `order_line_item` | 0 |
| `delivery` | 57 |
| `delivery_partner` | 30 |
| `delivery_proof` | 0 |
| `payment_transaction` | 53 |
| `accounting_voucher` | 0 |
| `accounting_journal_line` | 0 |
| `product` | 65 |
| `product_variant` | 27 |
| `branch_inventory` | 424 |
| `customer` | 57 |
| `branch` | 57 |
| `order_status_history` | 94 |
| `order_event` | 13 |
| `order_note` | 0 |
| `order_lifecycle_refund` | 0 |

### TypeScript Compiler
```
$ npx tsc --noEmit
# Exit code: 0  — 0 errors
```

### Git Working Tree
```
Clean (no production code changes — only checkpoint docs and scratch scripts)
```

### Frozen Accounting Engine
Phase 5A.6 services remain 100% untouched:
- `SalesPostingService` (1,880 lines) — Preserved
- `PostingService` — Preserved
- `SalesTaxEngine` — Preserved
- `CustomerReceiptService` — Preserved
- `SalesInvoiceReversalService` — Preserved
- All 99 accounting accounts — Preserved

---

## 15. STOP CONDITION

**Phase 5B.2 Forensic & Design Gate is COMPLETE and LOCKED.**

**DO NOT implement Phase 5B.3 without explicit user authorization.**

The following items require user review before proceeding:
1. Confirmation that the corrected flow (Section 8) accurately represents the business requirement
2. Decision on invoice persistence model (new `invoice` table vs `order.metadata` JSONB extension vs separate document store)
3. Confirmation on whether to migrate the PostgreSQL `order_status_enum` to include operational lifecycle states, or continue with metadata-based status tracking
4. Decision on delivery proof requirements (mandatory photo/signature vs optional)
