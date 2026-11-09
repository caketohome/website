# PHASE 6.1.3 — WEBHOOK SECURITY & CRYPTOGRAPHIC VERIFICATION
## HMAC-SHA256 Signature Verification, Replay Defense & Idempotency
**Entity:** CakeToHome India Private Limited  

---

### 1. Signature Verification Contract
- **Headers Inspected:**
  - `x-webhook-signature`
  - `x-webhook-timestamp`
- **Algorithm:**
  ```
  expectedSignature = Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
  ```
- **Constant-Time Comparison:** Evaluated using `crypto.timingSafeEqual` to prevent timing attacks.
- **Replay Window:** 300 seconds (5 minutes). Events older than 300s are rejected with HTTP 400.

---

### 2. Idempotency Ledger
All incoming webhooks are registered in `public.payment_webhook_event`:
- Primary Key / Unique Index on `id` (`cf_event_...` or `cf_verify_...`).
- Row locking with `SELECT ... FOR UPDATE` guarantees that concurrent deliveries are safely serialized.
