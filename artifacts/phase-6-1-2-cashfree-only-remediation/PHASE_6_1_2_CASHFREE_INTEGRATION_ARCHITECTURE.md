# CAKETOHOME — PHASE 6.1.2 CASHFREE INTEGRATION ARCHITECTURE
## CASHFREE PG V2023-08-01 SPECIFICATION, SESSION LIFECYCLE & WEB SDK V3

**Company:** CakeToHome India Private Limited  
**API Specification:** Cashfree PG API v2023-08-01  
**Web SDK:** Cashfree JS SDK v3 (`https://sdk.cashfree.com/js/v3/cashfree.js`)

---

### 1. ARCHITECTURAL TOPOLOGY

The Cashfree PG integration spans three cohesive tiers:
1. **Frontend Presentation Tier (Next.js 14 App Router):**
   - Recipient Checkout Form (`/checkout`)
   - Cashfree Dedicated Payment Interface (`/checkout/cashfree`) loading Web SDK v3
   - Customer Order Confirmation (`/your-order`)
2. **Application & API Gateway Tier (Next.js Route Handlers + NestJS):**
   - `POST /api/v1/payments/cashfree/order`: Generates official Cashfree order session token.
   - `POST /api/v1/payments/cashfree/verify`: Validates transaction completion and confirms order.
   - `POST /api/v1/webhooks/cashfree`: Asynchronous server-to-server webhook ingestion.
3. **Database & Accounting Tier (PostgreSQL 16.14):**
   - Atomic state machine executing order confirmation, payment recording, KOT dispatch, and tax invoicing.

### 2. SESSION CREATION CONTRACT (V2023-08-01)

```json
{
  "order_id": "CTH-2026-XXXX",
  "order_amount": 525.00,
  "order_currency": "INR",
  "customer_details": {
    "customer_id": "cus_ananya_sharma",
    "customer_name": "Ananya Sharma",
    "customer_email": "ananya.sharma@example.com",
    "customer_phone": "9876543210"
  },
  "order_meta": {
    "return_url": "http://localhost:3000/your-order?order_id=CTH-2026-XXXX&order_token={order_token}",
    "notify_url": "http://localhost:3000/api/v1/webhooks/cashfree",
    "payment_methods": "upi,cc,dc,nb,app"
  }
}
```

### 3. CASHFREE WEB SDK V3 INITIALIZATION

The dedicated checkout page dynamically initializes Cashfree SDK v3:
```javascript
const cashfree = Cashfree({ mode: "sandbox" });
cashfree.checkout({
  paymentSessionId: session.payment_session_id,
  redirectTarget: "_self"
});
```
