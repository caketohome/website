# Production Release Runbook — Phase 4.9

---

## 1. Controlled Activation Runbook (Post-Board Approval)
1. **Pre-Flight Check**: Ingest signed Board resolution and verify Director DINs.
2. **Configuration**: Execute migration script inserting approved series configuration into `compliance_invoice_series`.
3. **Smoke Test**: Issue single internal test order in sandbox.
4. **Gate Switch**: Toggle `IS_PRODUCTION_INVOICING_ACTIVE = true` via authenticated dual-token release command.
5. **Post-Release Monitoring**: Observe serial sequence allocation on live storefront orders.
