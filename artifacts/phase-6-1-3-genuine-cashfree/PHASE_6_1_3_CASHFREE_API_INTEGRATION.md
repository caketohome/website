# PHASE 6.1.3 — CASHFREE API SPECIFICATION & INTEGRATION
## Official PG 2023-08-01 REST Contract Implementation
**Entity:** CakeToHome India Private Limited  

---

### 1. Specification Overview
- **Protocol:** HTTPS REST
- **Base URL (Sandbox):** `https://sandbox.cashfree.com/pg`
- **Base URL (Production):** `https://api.cashfree.com/pg`
- **API Version:** `2023-08-01`
- **Authentication Headers:**
  - `x-api-version: 2023-08-01`
  - `x-client-id: ${CASHFREE_APP_ID}`
  - `x-client-secret: ${CASHFREE_SECRET_KEY}`
  - `Content-Type: application/json`

---

### 2. Endpoints Implemented & Verified
1. **Order Session Creation (`POST /orders`):**
   - Creates a server-side order and returns `payment_session_id`.
   - Payload includes `order_id`, `order_amount`, `order_currency`, `customer_details`, `order_meta`.
2. **Order Status Retrieval (`GET /orders/{order_id}`):**
   - Queries authoritative status directly from Cashfree servers.
   - Statuses evaluated: `ACTIVE`, `PAID`, `EXPIRED`.
3. **Payments for Order Query (`GET /orders/{order_id}/payments`):**
   - Retrieves array of payment attempts.
   - Evaluates `payment_status === "SUCCESS"`, payment mode, and reference ID.
