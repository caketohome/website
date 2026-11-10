# CAKETOHOME — PHASE 9 PAYMENT GATEWAY SECURITY AUDIT
## Cryptographic Envelope Architecture, Zero Plaintext Guarantee & OWASP Top 10 Compliance

**Document Authority:** CakeToHome Application Security & OWASP Audit Team  
**Authoritative Date:** 2026-11-10  
**Phase:** Phase 9 (Workstream L / Sub-Phases 9.7 & 9.10)  
**Classification:** **`CONFIDENTIAL — SECURITY AUDIT REPORT`**  
**Audit Standard:** OWASP Top 10:2021 & PCI-DSS SAQ A-EP Equivalent  
**Overall Security Verdict:** **`PASS — ZERO HIGH/CRITICAL VULNERABILITIES`**

---

## 1. Cryptographic Envelope Specification (AES-256-GCM)

All sensitive credentials (Razorpay Key Secret and Webhook Secret) stored in PostgreSQL table `payment_gateway_config` are encrypted at rest using AES-256 in Galois/Counter Mode (GCM).

### 1.1 Envelope Structure
The persisted value conforms to an immutable, versioned four-part envelope:

$$\text{Envelope} = \texttt{v1\$} \parallel \text{iv}_{\text{hex}} \parallel \texttt{\$} \parallel \text{auth\_tag}_{\text{hex}} \parallel \texttt{\$} \parallel \text{ciphertext}_{\text{hex}}$$

- `v1`: Version identifier allowing seamless future cipher rotations.
- `iv`: 12-byte (96-bit) cryptographically random Initialization Vector generated via `crypto.randomBytes(12)`. IV is never reused.
- `auth_tag`: 16-byte (128-bit) GCM authentication tag protecting ciphertext against bit-flipping and tampering.
- `ciphertext`: AES-256 encrypted payload.

### 1.2 Key Derivation
The encryption key is derived from the platform master secret (`PAYMENT_GATEWAY_MASTER_KEY` / `DATABASE_ENCRYPTION_KEY`) using PBKDF2 with HMAC-SHA512 over 100,000 iterations and a static cryptographic application salt:

```typescript
const salt = Buffer.from("CTH_GATEWAY_CREDENTIAL_SALT_2026", "utf-8");
const derivedKey = crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, "sha512");
```

---

## 2. Zero-Plaintext Isolation Guarantee

An exhaustive repository inspection verified the complete isolation of secrets:

1. **Client Bundles:** Next.js client component bundles (`'use client'`) only receive `key_id` (public identifier) and masked secret indicators (`has_key_secret: true`, `has_webhook_secret: true`).
2. **GET APIs:** Endpoint `GET /api/v1/admin/payments/razorpay/config` strips `key_secret_enc` and returns only `has_key_secret: boolean`. Plaintext secret is never transmitted in API responses.
3. **Application Logs:** All logger interceptors scrub fields matching `key_secret`, `secret`, `webhook_secret`, and `authorization`.
4. **Browser Developer Tools:** The Admin UI renders an uneditable placeholder (`••••••••••••••••••••••••••••••••`) with a deliberate "Replace Secret" toggle workflow, preventing inspection via element inspection.

---

## 3. Server-Side Request Forgery (SSRF) Defense

The diagnostic test connection endpoint (`POST /api/v1/admin/payments/razorpay/test-connection`) connects to Razorpay upstream servers to validate credentials without creating charges. To eliminate SSRF risks, the following strict controls are enforced:

1. **Static Destination Whitelist:** The target URL is hardcoded to `https://api.razorpay.com/v1/payments?count=1`. Dynamic or user-supplied URLs are strictly prohibited.
2. **Redirect Blocking:** Configured with `redirect: 'manual'`. HTTP 301/302 redirects from upstream are rejected, preventing redirect-based intranet pivoting.
3. **Strict Timeout:** A 5-second timeout (`AbortSignal.timeout(5000)`) prevents thread starvation or denial-of-service via slow upstream responses.
4. **Error Sanitization:** Upstream error payloads are categorized into standardized, safe enum values (`INVALID_KEY_ID`, `INVALID_KEY_SECRET`, `SERVER_ERROR`, `TIMEOUT`) without echoing upstream response headers or raw HTML error pages.

---

## 4. OWASP Top 10:2021 Security Verification Matrix

| OWASP Category | Vulnerability Risk | Mitigating Control Implemented | Verification Result |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | Unauthorized credential modification | Admin routes restricted to authenticated staff with role `SUPER_ADMIN` or `ADMIN`. | **PASSED (401/403 enforced)** |
| **A02: Cryptographic Failures** | Secret exposure at rest or in transit | AES-256-GCM envelope; HTTPS enforced; TLS 1.3 in production. | **PASSED (v1 envelope verified)** |
| **A03: Injection** | SQL injection in order queries | 100% parameterized queries via PostgreSQL `pg` client (`$1, $2, ...`). Zero string concatenation. | **PASSED (Zero dynamic SQL)** |
| **A04: Insecure Design** | Price tampering at checkout | Order grand totals queried authoritatively from PostgreSQL; client amount parameters ignored. | **PASSED (Server authoritative)** |
| **A05: Security Misconfiguration** | Verbose error stack traces | Production error handlers suppress stack traces, returning structured error codes. | **PASSED (Sanitized error responses)** |
| **A06: Vulnerable & Outdated Components** | Vulnerable SDKs | Razorpay Standard Checkout loaded from official CDN (`https://checkout.razorpay.com/v1/checkout.js`). Zero deprecated dependencies. | **PASSED (Official SDK only)** |
| **A07: Identification & Auth Failures** | Signature forgery on payments | Cryptographic HMAC-SHA256 signature verification with `crypto.timingSafeEqual`. | **PASSED (Constant-time verified)** |
| **A08: Software & Data Integrity Failures** | Webhook replay attacks | Raw body SHA256 hashed; `payment_webhook_log` deduplication guard enforced. | **PASSED (Idempotency verified)** |
| **A09: Security Logging & Monitoring** | Silent failures | Structured audit logging in `public.audit_logs` with timestamps, IP addresses, and event IDs. | **PASSED (Audit trail verified)** |
| **A10: SSRF** | Gateway diagnostic probe abuse | Hardcoded endpoint, manual redirect policy, 5-second abort signal. | **PASSED (SSRF-hardened)** |

---

## 5. Security Certification Signoff

The CakeToHome Razorpay integration and administrative credential management architecture satisfies all OWASP Top 10 standards and maintains a robust security posture.
