# CakeToHome ERP — Complete Security & Authorization Report

**Document Identifier**: `SECURITY-AUTH-REPORT-20261018`  
**Governing Skill**: `security-auditing-and-owasp`  
**Scope**: Server-Side Authentication, Session Security, RBAC Matrix, Tenant & Branch Isolation, BOLA/IDOR Defense  
**Verification Date**: 2026-10-18T20:16:30+05:30  
**Security Disposition**: **VERIFIED — ZERO CRITICAL VULNERABILITIES DETECTED**

---

## 1. Core Principle: Server-Side Enforcement

In accordance with OWASP standards and the `security-auditing-and-owasp` skill runbook:
$$\text{UI Visibility} \neq \text{Authorization}$$
- **Zero Client-Side Reliance**: Hiding admin panels, tabs, or buttons in React client state is strictly treated as UX affordance. All privilege checks are enforced on server route handlers, domain services, and database queries.
- **Fail-Closed Execution**: If a session token is missing, expired, signed with an invalid secret, or lacks the necessary resource permission, the request terminates immediately with `401 Unauthorized` or `403 Forbidden`.

---

## 2. Authentication & Session Architecture

1. **JWT Verification**:
   - Signature algorithm: `HS256` signed using `JWT_SECRET`.
   - Expiration TTL: Explicit `exp` timestamp validation.
   - Dual delivery: Accepts either `Authorization: Bearer <jwt>` header or `_cth_jwt` HttpOnly cookie.
2. **Session Cookies**:
   - Standard cookie configuration: `_cth_jwt`, `_cth_role`, `_cth_user_id`.
   - Security flags: `HttpOnly` (inaccessible to malicious XSS), `SameSite=Lax`.
3. **Customer OTP Security**:
   - OTP codes are generated via cryptographically secure random sources, rate-limited to prevent brute-force attacks, and invalidated upon first use.

---

## 3. Authorization & Access Control (RBAC)

Every route handler and domain service asserts role and resource capabilities:

| Role Tested | Route Attempted | Expected Result | Actual Result | Security Disposition |
| :--- | :--- | :---: | :---: | :---: |
| **Anonymous (Unauthenticated)** | `/api/v1/admin/accounting/vouchers` | `401 Unauthorized` | `401 Unauthorized` | `PASS` |
| **Customer** | `/api/v1/admin/accounting/trial-balance` | `403 Forbidden` | `403 Forbidden` | `PASS` |
| **Delivery Partner** | `/api/v1/admin/accounting/vouchers` | `403 Forbidden` | `403 Forbidden` | `PASS` |
| **Branch Staff** | `/api/v1/admin/accounting/period-close` | `403 Forbidden` | `403 Forbidden` | `PASS` |
| **Branch Manager (Branch A)** | Alter cash drawer of Branch B | `403 Forbidden` | `403 Forbidden` | `PASS` |
| **Cashier / Teller** | Settle shift without supervisor approval | Blocked by SoD | Blocked by SoD | `PASS` |
| **Expense Maker** | Approve self-created expense voucher | Blocked by SoD | Blocked by SoD | `PASS` |

---

## 4. Broken Object-Level Authorization (BOLA / IDOR) Defense

- **Order Access**: Customers can query only their own orders (`customer_id = auth.user_id`). Attempting to fetch another customer's order by ID returns `404 Not Found` or `403 Forbidden`.
- **Branch Scope Filtering**: Queries for branch inventory, retail drawer shifts, and local cash positions always scope queries with `WHERE branch_id = $1`.

---

## 5. Fail-Closed Domain Guards

1. **Statutory Tax Fail-Closed Guard**:
   - If an item in the cart or purchase invoice has no authoritative tax mapping in PostgreSQL `public.tax_rate`, the transaction aborts with `MISSING_TAX_RATE`. The system never defaults to 0% or guesses tax rates.
2. **Cash Overdraft Concurrency Guard**:
   - Cash disbursements from petty cash or retail teller drawers acquire row locks (`FOR UPDATE`). If the requested amount exceeds the verified balance, the disbursement is aborted, preventing double-spend and overdraft.
3. **Quarantine of Legacy Prototype Invoices**:
   - 5 historical test invoices (`CTH/26-27/000031` to `000035`) are quarantined; voucher creation or ledger postings against them are strictly blocked (`LEGACY_PROTOTYPE_ORDER_REJECTED`).
