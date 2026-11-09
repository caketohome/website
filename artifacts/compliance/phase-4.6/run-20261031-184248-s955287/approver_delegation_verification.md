# Approver Delegation Verification
**Audited Route:** `POST /api/v1/admin/compliance/invoice-series/approve`  

---

## 1. Technical vs Corporate Authority Boundary
- The application endpoint requires `SUPER_ADMIN` or `FINANCE_CONTROLLER` session roles and strictly rejects anonymous requests with HTTP 403.
- Technical privilege in software does **not** substitute for corporate legal authority.
- To prevent regulatory non-compliance, all operational series remain in `PROPOSED` or `REVOKED_SYNTHETIC` status until the formal corporate delegation document is executed.
