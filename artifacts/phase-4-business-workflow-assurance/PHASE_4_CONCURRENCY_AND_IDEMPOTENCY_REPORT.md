# CAKETOHOME — CONCURRENCY AND IDEMPOTENCY REPORT
## Race Condition Prevention, Row Locks & Idempotency Keys

### 1. Concurrency Controls
- **PostgreSQL Row-Level Locking:** Webhook processing employs `SELECT ... FOR UPDATE` to serialize concurrent webhook notifications for the same payment.
- **Idempotency Keys:** Unique keys on checkout prevent duplicate order creation during double-clicks or mobile network retries.
- **Event Audit Deduplication:** `payment_webhook_event` table records every `provider_payment_id`, establishing a reliable deduplication boundary.
