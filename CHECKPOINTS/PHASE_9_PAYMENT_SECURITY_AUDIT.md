# CAKETOHOME — PHASE 9 PAYMENT SECURITY AUDIT
**Platform:** CakeToHome (https://cakestohome.com/)  
**Standard:** OWASP Top 10 (2021), PCI-DSS SAQ-A Compliance, NIST SP 800-38D  
**Lead Auditor:** Payment Security Architect & Lead Security Engineer  
**Date:** 2026-11-10  

---

## 1. Cryptographic Envelope & Secret Storage

Payment gateway secrets (`key_secret` and `webhook_secret`) are encrypted at rest in PostgreSQL `public.payment_gateway_config` using authenticated AES-256-GCM.

- **Envelope Format:** `v1$iv$authTag$ciphertext`
- **Algorithm:** AES-256-GCM (NIST SP 800-38D compliant)
- **Key Derivation:** Master key derived from `PAYMENT_ENCRYPTION_KEY` via PBKDF2 (100,000 iterations, SHA-512).
- **IV / Nonce:** 12-byte cryptographically secure pseudorandom nonce generated per encryption operation.
- **Authentication Tag:** 16-byte GCM authentication tag verified during decryption to guarantee confidentiality and ciphertext authenticity.

---

## 2. Zero-Plaintext Secret Exposure Policy

1. **API Responses:**
   All administrative GET endpoints (`/api/v1/admin/payments/razorpay/config`) strictly omit plaintext secrets. The JSON response returns:
   ```json
   {
     "key_id": "rzp_test_saved_key_12345",
     "has_key_secret": true,
     "has_webhook_secret": true
   }
   ```
2. **Client-Side HTML / Bundles:**
   Plaintext secrets are never injected into Next.js client component props or emitted into script tags. Only `key_id` is delivered to `checkout.js`.

---

## 3. SSRF & Diagnostic Probe Hardening

- The test connection probe (`/api/v1/admin/payments/razorpay/test-connection`) validates credentials by performing a non-mutating HTTP Basic Auth request to the hardcoded endpoint:
  `https://api.razorpay.com/v1/payments?count=1`
- URL parameters are non-configurable; user-supplied hostname or port parameters are rejected, eliminating Server-Side Request Forgery (SSRF) attack vectors.

---

## 4. OWASP Top 10 (2021) Compliance Matrix

| Vulnerability Category | Risk Scenario | Protection Mechanism Implemented | Status |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | Unauthorized user edits gateway keys | Server-side RBAC verifies `admin` role on all `/admin/payments/*` endpoints | **PASSED** |
| **A02: Cryptographic Failures** | Plaintext keys exposed in database dumps | AES-256-GCM envelope encryption with unique IV and auth tag | **PASSED** |
| **A03: Injection** | SQL injection via order ID in payment query | Parameterized queries (`$1`, `$2`) across all database queries | **PASSED** |
| **A04: Insecure Design** | Premature live payments without business KYC | Release Gate E server-side blocker returns HTTP 403 unless verified | **PASSED** |
| **A05: Security Misconfiguration** | Gateway keys committed in source control | Config read from encrypted DB table and environment variables | **PASSED** |
| **A07: Identification & Auth Failures** | Forged payment confirmation | Server-side HMAC-SHA256 signature verification via constant-time equality | **PASSED** |
| **A08: Software & Data Integrity** | Tampered webhook payloads | HMAC-SHA256 signature validation on `X-Razorpay-Signature` | **PASSED** |
