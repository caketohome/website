# CAKETOHOME — ARCHITECTURE AND DEPENDENCY MAP
## Phase 4 System Architecture, Component Topology & Service Boundaries

### 1. Component Topology
```
[ Storefront Client (Next.js 14) ]
               │
               ▼
   [ Next.js API Gateway / Router ]
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
[ Supabase Auth & JWT ]      [ Payment Webhook Route ]
(auth.users / profiles)      (Razorpay HMAC SHA-256)
       │                                │
       └───────────────┬────────────────┘
                       ▼
       [ Core Application Services ]
       ├── OrderService (Checkout & Idempotency)
       ├── PaymentVerificationService (Atomic Confirmation)
       ├── InventoryService (Stock Movement Ledger)
       ├── DeliveryInvoicingService (CH Invoice Series)
       └── GeneralLedgerService (Vouchers & Double Entry)
                       │
                       ▼
       [ PostgreSQL Database (Port 5433) ]
       ├── auth.users & public.profiles
       ├── public.order & public.order_item
       ├── public.payment_transaction & payment_webhook_event
       ├── public.branch_inventory & inventory_movement
       ├── public.customer_notification_queue
       ├── public.invoice & invoice_sequence (CH)
       └── public.accounting_voucher & accounting_journal_entry
```

### 2. Service Responsibilities & Invariants
- **Authentication Service:** Uses Supabase Auth conventions with local JWT verification via `jose` / HMAC-SHA256. Enforces role-based permissions (`SUPER_ADMIN`, `ADMIN`, `STORE_MANAGER`, `STORE_STAFF`, `CUSTOMER`).
- **Payment Verification Engine:** Intercepts Razorpay webhooks and client callbacks. Verifies HMAC-SHA256 signatures before touching database state.
- **Order State Machine:** Enforces linear lifecycle (`pending_payment` → `confirmed` → `in_production` → `out_for_delivery` → `delivered`).
- **Statutory Invoicing Engine:** Enforces Order ≠ Bill invariant. `invoice_number` is strictly allocated at delivery transition using PostgreSQL atomic sequence `allocate_invoice_number` with `CH` prefix.
- **Inventory Ledger:** Dual-entry inventory movements with positive quantities and `direction = 'OUT'` for sales, preventing negative drift.
