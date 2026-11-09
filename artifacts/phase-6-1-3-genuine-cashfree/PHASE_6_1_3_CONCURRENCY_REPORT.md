# PHASE 6.1.3 — CONCURRENCY & RACE CONDITION DEFENSE
## High-Throughput Locking, Parallel Webhooks & Browser Redirects
**Entity:** CakeToHome India Private Limited  

---

### 1. Concurrency Model
- When a customer completes payment, the webhook and browser return may arrive simultaneously.
- PostgreSQL `SELECT ... FOR UPDATE` acquires an exclusive row lock on the order and idempotency record.
- The secondary request sees the committed `PAID` state and immediately returns existing order details without duplicate processing.
