# SECURITY AND AUTHORIZATION AUDIT
**Scope:** Segregation of Duties (SoD), Role-Based Access Control, Token Lifecycle  

### Audit Verifications:
1. **Segregation of Duties:** Software and release engineers are prohibited from approving production activation. Database `CHECK (requester_id != approver_id)` enforced.
2. **Replay Defense:** Consumed Layer 5 authorization records cannot be reused.
3. **Revocation Defense:** Revocation of authorization immediately aborts activation.
4. **TTL Expiry:** Authorizations older than 24 hours are rejected.
5. **Read-Only Invariant:** Protected database `cth_test` preserved with 0 writes.