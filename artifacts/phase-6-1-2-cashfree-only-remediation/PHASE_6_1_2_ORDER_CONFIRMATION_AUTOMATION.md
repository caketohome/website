# CAKETOHOME — PHASE 6.1.2 ORDER CONFIRMATION AUTOMATION
## ATOMIC DATABASE STATE TRANSITION, IDEMPOTENCY & CONFIRMATION MECHANICS

**Company:** CakeToHome India Private Limited  
**Engine:** PostgreSQL 16.14 Atomic Transaction Engine

---

### 1. ATOMIC STATE TRANSITION

When Cashfree verifies payment, the backend executes an atomic PostgreSQL transaction:
```sql
BEGIN;

-- 1. Transition Order Status
UPDATE public."order"
SET status = 'confirmed',
    payment_status = 'paid',
    updated_at = NOW()
WHERE id = $1 AND status = 'pending';

-- 2. Record Cashfree Payment Transaction
INSERT INTO public.payment_transaction (
  id, order_id, provider, amount, currency, status,
  gateway_transaction_id, payment_method, created_at, updated_at
) VALUES (
  $2, $1, 'cashfree', $3, 'INR', 'success',
  $4, $5, NOW(), NOW()
);

-- 3. Generate Kitchen Order Ticket (KOT)
INSERT INTO public.kot_tickets (
  id, kot_number, order_id, branch_id, status, created_at, updated_at
) VALUES (
  $6, $7, $1, $8, 'queued', NOW(), NOW()
);

-- 4. Deduct Inventory & Record Movement
INSERT INTO public.inventory_movement (
  id, variant_id, branch_id, quantity, movement_type, reference_id, created_at
) VALUES (
  $9, $10, $8, -1, 'sale', $1, NOW()
);

-- 5. Record Outbox Event for Cross-App Sync
INSERT INTO public.outbox_events (
  id, aggregate_type, aggregate_id, event_type, payload, status, created_at
) VALUES (
  $11, 'order', $1, 'order.confirmed', $12, 'published', NOW()
);

COMMIT;
```

### 2. IDEMPOTENCY GUARANTEES

To prevent double confirmation from simultaneous webhook and client redirects:
- `gateway_transaction_id` is guarded with a unique index.
- If an order is already `confirmed`, subsequent verification requests return HTTP 200 with the existing confirmation record without modifying balances or generating duplicate KOTs.
