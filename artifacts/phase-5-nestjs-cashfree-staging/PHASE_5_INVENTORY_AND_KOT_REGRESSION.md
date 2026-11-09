# CAKETOHOME — INVENTORY & KOT REGRESSION REPORT
## Stock Movements, Kitchen Tickets & Re-Print Auditing

### 1. Inventory Movement Invariant
- Sales deductions strictly record `direction = 'OUT'`.
- Quantity matches order line item quantity.
- Movement references `order_id` and `branch_id`.
- Tested in **CF-07** and **E2E-07** — **PASS**.

### 2. Kitchen Order Ticket (KOT) Invariant
- Generated upon payment confirmation.
- Format: `KOT-YYYYMMDD-XXXX` or `KOT-000XX`.
- Stored idempotently in `order.metadata` and `order_status_history`.
- Tested in **CF-08** and **E2E-08** — **PASS**.
