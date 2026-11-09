# CAKETOHOME — PAYMENT AND WEBHOOK ASSURANCE REPORT
## Cryptographic Verification, Idempotency & Gateway Security

### 1. Razorpay Integration Assurance
- **Webhook Signature Verification:** HMAC-SHA256 signature calculated over raw request body using `RAZORPAY_WEBHOOK_SECRET`.
- **Client Signature Verification:** HMAC-SHA256 signature calculated over `${order_id}|${payment_id}` using `RAZORPAY_KEY_SECRET`.
- **Replay Protection:** Incoming webhooks logged in `public.payment_webhook_event`. Duplicate deliveries for already-processed `provider_payment_id` are acknowledged with HTTP 200 without duplicate execution.
- **Amount & Currency Validation:**
  - Amount in paise strictly matched against `ROUND(order.grand_total * 100)`.
  - Currency strictly verified as `INR`.
  - Violations immediately diverted to `payment_exception`.
