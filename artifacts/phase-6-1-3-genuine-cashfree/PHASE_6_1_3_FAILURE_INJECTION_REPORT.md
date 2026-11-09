# PHASE 6.1.3 — FAILURE INJECTION & RESILIENCE AUDIT
## Chaos Testing, Gateway Disconnects & Transaction Rollbacks
**Entity:** CakeToHome India Private Limited  

---

### 1. Scenarios Executed
1. **Unprovisioned Merchant Credentials:** System gracefully captures HTTP 401 from Cashfree sandbox and provides clear diagnostic notices without crashing.
2. **Tampered Payment Amount:** Verification engine compares expected cart total against gateway amount; rejects payment if mismatch detected.
3. **Database Timeout / Error:** Entire multi-table transaction aborts; zero partial writes or phantom orders.
4. **Duplicate Webhook Delivery:** Idempotency ledger intercepts repeated event; returns HTTP 200 without duplicate KOT or stock deduction.
