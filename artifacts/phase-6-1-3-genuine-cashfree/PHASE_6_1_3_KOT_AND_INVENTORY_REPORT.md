# PHASE 6.1.3 — KITCHEN ORDER TICKET (KOT) & INVENTORY AUTOMATION
## Automated Production Dispatch & Real-Time Stock Depletion
**Entity:** CakeToHome India Private Limited  

---

### 1. KOT Generation
- Ticket ID format: `KOT-YYYY-XXXX`
- Auto-routed to the assigned fulfillment branch (e.g., `br_indiranagar_01`).
- Contains preparation schedule, cake flavor, weight, custom message, and allergen warnings.

---

### 2. Inventory Depletion
- Immediate stock deduction recorded in `public.inventory_movement`.
- Real-time notification to branch manager if safety stock threshold is breached.
