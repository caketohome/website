# CAKETOHOME — CASHFREE WEBHOOK SECURITY REPORT
## Cryptographic Signature Verification, Replay Defense & Idempotency

### 1. Signature Algorithm
- **Algorithm:** HMAC-SHA256
- **Signed Payload:** `x-webhook-timestamp + rawBody`
- **Encoding:** Base64
- **Header:** `x-webhook-signature`
- **Comparison:** `crypto.timingSafeEqual` against timing attacks.

### 2. Verification Test Evidence
- **CF-01**: Authentic webhook signature accepted — **PASS**
- **CF-02**: Tampered payload rejected — **PASS**
- **CF-03**: Tampered timestamp rejected — **PASS**
- **CF-04**: Invalid secret key rejected — **PASS**
- **CF-10**: Replay attack deduplicated via `payment_webhook_event` — **PASS**
