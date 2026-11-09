# PHASE 6.1.3 — OWASP APPLICATION SECURITY & DATA PROTECTION
## Vulnerability Assessment, Threat Modeling & Defense Verification
**Entity:** CakeToHome India Private Limited  

---

### 1. Security Controls Verified
- **No Client Trust:** The client cannot alter order amount or mark orders as paid.
- **Encrypted Credentials:** API Secret Keys stored in environment variables, never sent to browser.
- **SQL Injection Prevention:** 100% of queries use parameterized prepared statements.
- **CSRF & Webhook Spoofing Defense:** HMAC-SHA256 signatures with 300s expiry windows.
- **RBAC Enforcement:** JWT token verification with role checks on admin and branch endpoints.
