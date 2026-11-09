# CAKETOHOME — PHASE 6.1.2 DATABASE STATE MACHINE
## POSTGRESQL SCHEMA SPECIFICATION, REFERENTIAL INTEGRITY & STATE TRANSITIONS

**Company:** CakeToHome India Private Limited  
**Database:** PostgreSQL 16.14 (`cth_rehearsal_phase5` on port 5433)

---

### 1. ENTITY-RELATIONSHIP ARCHITECTURE

```
  ┌──────────────────┐       1:N       ┌────────────────────────┐
  │  public."order"  │─────────────────│ public.payment_trans   │
  └─────────┬────────┘                 └────────────────────────┘
            │ 1:1
            ├──────────────────────────┐
            │ 1:1                      │ 1:1
  ┌─────────▼────────┐       ┌─────────▼────────┐
  │ public.kot_tick  │       │  public.invoice  │
  └──────────────────┘       └──────────────────┘
            │ 1:N
  ┌─────────▼────────┐
  │ public.inv_mov   │
  └──────────────────┘
```

### 2. ORDER STATUS STATE MACHINE

- **Initial State:** `status = 'pending'`, `payment_status = 'pending'`
- **Payment Success (Cashfree):** `status = 'confirmed'`, `payment_status = 'paid'`
- **Kitchen Acceptance:** `status = 'in_preparation'`
- **Bake & Quality Check:** `status = 'ready_for_dispatch'`
- **Rider Out For Delivery:** `status = 'out_for_delivery'`
- **Delivery Complete:** `status = 'delivered'`
- **Payment Failure / Cancellation:** `status = 'cancelled'`, `payment_status = 'failed'`
