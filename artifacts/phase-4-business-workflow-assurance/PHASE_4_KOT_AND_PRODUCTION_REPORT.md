# CAKETOHOME — KITCHEN ORDER TICKET (KOT) & PRODUCTION REPORT
## Kitchen Dispatch, Sequential Numbering & Idempotency

### 1. KOT Generation
- **Trigger:** Immediate upon order confirmation (`order.status = 'confirmed'`).
- **Format:** `KOT-${order_number}` (e.g. `KOT-CTH-20261103-9545`).
- **Idempotency:** Re-requesting or reprinting a KOT does not allocate a new KOT number; it increments `reprint_count` and appends an audit log.
- **Production Statuses:** `pending` → `in_production` → `ready`.
