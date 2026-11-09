# CAKETOHOME — FAILURE INJECTION REPORT
## Resilience Under Tampering, Replay & Network Faults

### 1. Injected Failure Scenarios
1. **Tampered Payload:** Payment amount altered in transit -> Cryptographically rejected (**CF-02 PASS**).
2. **Timestamp Replay:** Timestamp forged -> Cryptographically rejected (**CF-03 PASS**).
3. **Invalid Secret:** Signed with third-party secret -> Rejected (**CF-04 PASS**).
4. **Amount Mismatch:** Order ₹1000, paid ₹500 -> Transaction rejected (**CF-11 PASS**).
5. **Cancelled Order:** Payment arriving after customer cancellation -> Prevented from confirmation (**CF-12 PASS**).
6. **Duplicate Webhook:** Exact duplicate event dispatched -> Deduplicated gracefully (**CF-10 PASS**).
