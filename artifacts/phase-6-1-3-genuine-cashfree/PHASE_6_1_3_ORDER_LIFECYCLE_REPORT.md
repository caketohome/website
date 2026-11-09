# PHASE 6.1.3 — ORDER LIFECYCLE & REAL-TIME SYNCHRONIZATION
## Customer Journey: Product Selection to Kitchen Dispatch
**Entity:** CakeToHome India Private Limited  

---

### 1. Lifecycle Milestones
1. **Catalog & Discovery:** `/products` displays artisan cakes with prices and branch delivery eligibility.
2. **Cart Review:** `/cart` validates subtotal, GST (5%), and free delivery threshold.
3. **Checkout:** `/checkout` captures delivery address, schedule date/slot, and customer contact.
4. **Gateway Session:** `/checkout/cashfree` launches official Cashfree SDK v3 checkout.
5. **Confirmation:** `/your-order` displays live KOT ticket, order status, and Cashfree reference.
6. **Kitchen Queue:** `/branch-manager` displays the new order immediately in the preparation queue.
