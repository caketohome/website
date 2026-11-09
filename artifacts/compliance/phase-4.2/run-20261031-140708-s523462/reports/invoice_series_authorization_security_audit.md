# Invoice Series Authorization Security Audit — Phase 4.2 Independent Forensic Audit

## 1. Statutory Lifecycle State Machine

The invoice series configuration lifecycle enforces a strict separation of powers between operational configuration and statutory approval:

```
[Operational User / Admin] ──► Propose Series (POST /propose)
                                       │
                                       ▼
                       Status: PROPOSED, is_active: false
                                       │
                                       ├─► Allocation Attempt: BLOCKED (Fail-Closed)
                                       │
[Finance Controller / CA]   ──► Approve Series (POST /approve)
                                       │
                                       ▼
                       Status: APPROVED, is_active: true
                                       │
                                       ├─► Allocation Attempt: AUTHORIZED
                                       │
[Audit / Revocation Event]  ──► Deprecate/Revoke
                                       │
                                       ▼
                 Status: DEPRECATED_HISTORICAL / REVOKED
                                       │
                                       └─► Allocation Attempt: BLOCKED (Fail-Closed)
```

---

## 2. Server-Side Authorization & Endpoint Security

The administrative compliance endpoints in [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts) were audited against adversarial attacks:

| Endpoint | Method | Required Role | Client Forgery Defense | Audit Event Persistence |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/admin/compliance/legal-entities` | `GET` | Authenticated Staff | Read-only relational query | None (Idempotent read) |
| `/api/v1/admin/compliance/invoice-series` | `GET` | Authenticated Staff | Read-only sequence query | None (Idempotent read) |
| `/api/v1/admin/compliance/invoice-series/propose` | `POST` | Authenticated User | Payload `authorized_by` is ignored; sets `authorized_by = NULL`, `status = 'PROPOSED'` | Database row created with `PROPOSED` status |
| `/api/v1/admin/compliance/invoice-series/approve` | `POST` | `SUPER_ADMIN` or `FINANCE_CONTROLLER` | Payload `authorized_by` is discarded; uses verified `userCtx.userId` from cryptographic JWT | Database row updated with `authorized_by`, `authorized_at = NOW()` |

---

## 3. Adversarial Security Verification Results

The test suite [`test_compliance_api_security.cjs`](file:///e:/vig/.arena/scratch/test_compliance_api_security.cjs) executed the following attacks against `cth_disposable_phase4_2`:

1. **Unapproved Series Allocation Attack**:
   - Action: Submitting order for series in `PROPOSED` state.
   - Result: **BLOCKED**. Raised `UNAUTHORIZED_INVOICE_SERIES` (`approval_status 'PROPOSED', is_active=false`).
2. **Approved but Inactive Series Attack**:
   - Action: Submitting order for series with `approval_status = 'APPROVED'` but `is_active = false`.
   - Result: **BLOCKED**. Raised `UNAUTHORIZED_INVOICE_SERIES`.
3. **Cross-Entity Prefix Hijacking Attack**:
   - Action: Requesting series `CTH` (bound to `29AAACC1234F1Z5`) for seller `29AABCC1234F1Z5`.
   - Result: **BLOCKED**. Raised `INVOICE_SERIES_PREFIX_CONFLICT`.
4. **Client Forged Approver Identity Attack**:
   - Action: Client sends body `{ authorized_by: "malicious_actor", status: "APPROVED" }`.
   - Result: **DEFENDED**. Server code derives approver identity strictly from `userCtx.userId` extracted from authenticated session cookies/JWT.
5. **Cross-Company Branch Seller Isolation**:
   - Action: Attempting invoicing from partner branch `br_partner_04` lacking corporate legal entity links.
   - Result: **BLOCKED**. Fails closed with `AMBIGUOUS_SELLER_IDENTITY` / `MISSING_SELLER_CONTEXT`.

