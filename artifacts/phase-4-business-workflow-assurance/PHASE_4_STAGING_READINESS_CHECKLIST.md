# CAKETOHOME — STAGING READINESS CHECKLIST
## Pre-deployment Requirements for Staging Environment

- [x] Application codebase builds without errors.
- [x] Database migrations execute idempotently without data loss.
- [x] All 12 business workflows verified with automated tests.
- [x] All 30 failure injection scenarios (F01–F30) pass.
- [x] Protected baseline invariant verified (127 orders, 71 invoices, 4 vouchers).
- [ ] Staging Supabase Cloud project credentials configured.
- [ ] Staging Razorpay API credentials & webhook secret configured.
- [ ] Staging SMS provider credentials configured.
- [ ] Corporate board formal resolution adopted for production invoicing.
