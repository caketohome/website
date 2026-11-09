# CAKETOHOME — CASHFREE INTEGRATION ARCHITECTURE
## Official PG API v2023-08-01 Implementation & Drop Checkout

- **Provider:** Cashfree Payments India Private Limited
- **API Version:** `2023-08-01`
- **Integration Mode:** Drop Checkout with Server-Initiated Payment Sessions

### 1. Cashfree API Headers
```http
x-client-id: <CASHFREE_APP_ID>
x-client-secret: <CASHFREE_SECRET_KEY>
x-api-version: 2023-08-01
Content-Type: application/json
```

### 2. Order Initiation Endpoint: `POST /orders`
```json
{
  "order_id": "ord_1793783700",
  "order_amount": 787.50,
  "order_currency": "INR",
  "customer_details": {
    "customer_id": "cus_9876543210",
    "customer_phone": "9876543210",
    "customer_name": "Ananya Sharma",
    "customer_email": "ananya@example.com"
  },
  "order_meta": {
    "return_url": "https://caketohome.com/checkout/success?order_id={order_id}",
    "notify_url": "https://caketohome.com/api/v1/payments/cashfree/webhook"
  }
}
```
Returns: `payment_session_id`, `cf_order_id`, `order_status: "ACTIVE"`.
