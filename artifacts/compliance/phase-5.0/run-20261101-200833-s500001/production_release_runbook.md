# Production Release Runbook — Phase 5.0

---

## 1. Execution Sequence (Post-Board Approval)
1. Verify signed Board resolution and director DINs.
2. Ingest authenticated corporate authorization token.
3. Configure approved series in `compliance_invoice_series`.
4. Perform single customer order smoke test in sandbox.
5. Toggle activation gate to `ACTIVE`.
6. Issue first production invoice through standard checkout API.
7. Execute post-generation reconciliation.
