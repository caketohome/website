# CAKETOHOME — PHASE 6.1.2 KOT & INVENTORY INTEGRATION
## KITCHEN ORDER TICKET (KOT) GENERATION & REAL-TIME STOCK RESERVATION

**Company:** CakeToHome India Private Limited  
**Operations Module:** Branch Kitchen Operations (`/branch-manager`)

---

### 1. KOT AUTOMATION PIPELINE

Upon order confirmation via Cashfree PG:
1. System determines preparing branch using delivery pincode (e.g. `560038` -> `br_indiranagar_01`).
2. System allocates the next sequential ticket number for the branch (e.g. `KOT-00005`).
3. Ticket includes cake variant details, custom message on cake, recipient details, and target delivery slot.
4. Ticket is immediately broadcast to the Branch Manager Dashboard and Kitchen Display System (KDS).

### 2. REAL-TIME INVENTORY MOVEMENT

- Inventory is immediately reserved in `public.inventory_movement` with movement type `sale`.
- Real-time stock counts in `product_variant` are updated to prevent overselling of high-demand gourmet cakes.
