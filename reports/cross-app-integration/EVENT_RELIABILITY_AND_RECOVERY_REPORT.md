# CAKETOHOME — EVENT RELIABILITY & RECOVERY REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. OUTBOX RELIABILITY & RECOVERY
- **Idempotency:** Every consumer writes to `public.outbox_consumer_receipt` with `UNIQUE(event_id, consumer_name)`, guaranteeing exactly-once execution semantics even under network replays.
- **Dead-Letter Handling:** After 5 unsuccessful retry attempts, events automatically transition to status `DEAD_LETTER`, log `dead_lettered_at = NOW()`, and insert an actionable `CRITICAL` alert into `public.system_monitoring_alert`.
- **Operator Replay:** Operators can trigger `POST /api/v1/events/replay` with `{ event_id }`, resetting status to `PUBLISHED`, clearing errors, and automatically resolving the associated monitoring alert.
