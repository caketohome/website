# CAKETOHOME — AUTHENTICATION AND RBAC REPORT
## Security, Identity, Role Hierarchy & Token Verification

### 1. Role Taxonomy
The application implements 8 discrete system roles defined in `public.roles`:
- `SUPER_ADMIN`: Full global administrative authority across all branches, finance, and system settings.
- `ADMIN`: Storefront, catalog, customer, and operational administration.
- `STORE_MANAGER`: Authorized branch-level operations, staff, and inventory management.
- `STORE_STAFF`: Assigned branch operations, order fulfillment, and counter activities.
- `OPERATIONS`: Central fleet, logistics, delivery route planning, and dispatcher access.
- `FINANCE`: General ledger, GST reporting, BRS reconciliation, period close, and payouts.
- `DELIVERY_PARTNER`: Fleet delivery driver mobile interface and trip execution.
- `CUSTOMER`: Consumer storefront ordering, account profile, order history, and addresses.

### 2. Token Security Verification
- **JWT Issuance:** Signed with HMAC-SHA256 using server-held secret.
- **JWT Expiration:** Tokens past `exp` claim are rejected with HTTP 401 Unauthorized.
- **Tamper Resistance:** Any manipulation of header, payload, or signature bytes invalidates token verification.
- **RBAC Enforcement:** Non-administrative roles attempting admin actions receive HTTP 403 Forbidden.
