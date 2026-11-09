# Classification of 69 Unbilled Historical Orders

Forensic audit of the 69 orders in `public.order` with no associated `invoice` record:
1. **Confirmed Orders (26):** Active pipeline orders awaiting kitchen dispatch and formal billing.
2. **Delivered Orders (21):** Goods marked delivered during pre-release staging; primarily validation scenario test records.
3. **Pending Orders (19):** Checkout initiated, awaiting customer payment capture.
4. **Completed Orders (2):** Orders 98584 and 98586 completed on Oct 29 without invoice generation.
5. **Preparing Order (1):** Order 44098 in merchant kitchen state.

**Rule:** Zero automatic billing upon series activation.
