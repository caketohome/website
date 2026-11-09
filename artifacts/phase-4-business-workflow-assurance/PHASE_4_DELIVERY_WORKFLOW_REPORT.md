# CAKETOHOME — DELIVERY WORKFLOW & STATUTORY INVOICING
## Rider Handoff, Delivery OTP & CH Invoice Allocation

### 1. Delivery Handoff Lifecycle
1. Order packed at branch.
2. Rider assigned (`rider_id`, `rider_name`). Status moves to `out_for_delivery`.
3. Rider arrives at customer destination.
4. Customer provides 4-digit Delivery OTP.
5. Verification succeeds → Status moves to `delivered`.

### 2. Statutory Invoice Allocation
- Enforces the **Order ≠ Bill** invariant: `invoice_number` is strictly NULL throughout checkout, payment, and baking.
- Allocated exclusively upon transition to `delivered` via `public.allocate_invoice_number`.
- Series prefix: `CH` (e.g. `CH/26-27/000001`).
- Stored in `public.invoice` and linked to `public.order`.
