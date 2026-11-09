# CAKETOHOME — PHASE 6.1.2 FAILURE INJECTION & RESILIENCE
## EXHAUSTIVE FAULT TOLERANCE, TIMEOUT, WEBHOOK FAILURE & EDGE-CASE HANDLING

**Company:** CakeToHome India Private Limited  
**Testing Methodology:** Chaos & Failure Injection Testing

---

### 1. FAILURE INJECTION SCENARIOS & RESULTS

| Scenario ID | Test Description | Injected Fault | Expected Behavior | Observed Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIT-01** | Cashfree Gateway Timeout | Network delay > 5000ms | Timeout caught, graceful error message, prompt retry | Caught gracefully, customer advised to retry | **PASS** |
| **FIT-02** | User Payment Cancellation | User aborts payment at PG | Order remains pending, stock reservation uncommitted | Order untouched, cart restored | **PASS** |
| **FIT-03** | Duplicate Webhook Ingestion | Ingest same webhook twice | Idempotency guard prevents duplicate order confirmation | Second call returns 200 OK without double-entry | **PASS** |
| **FIT-04** | Forged Webhook Signature | Corrupted HMAC header | Signature mismatch, reject with 400 Bad Request | Rejected with 400 Bad Request, audit log written | **PASS** |
| **FIT-05** | Decommissioned Razorpay Call | POST to legacy route | Immediate rejection with HTTP 410 Gone | Returns 410 Gone with exact advisory | **PASS** |
| **FIT-06** | Invalid Order Amount | Amount mismatch in verify | Verification rejected, order not confirmed | Rejected with 400 Bad Request | **PASS** |
