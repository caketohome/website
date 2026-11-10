# CAKETOHOME — PHASE 9 SKILL USAGE MATRIX
**Phase:** Phase 9 — CMS, Legal Policy Management & Razorpay Payment Gateway Migration  
**Project:** CakeToHome (https://cakestohome.com/)  
**Author:** Principal Software Architect & Lead Full-Stack Engineer  
**Status:** ACTIVE / VERIFIED  

---

### 1. Mandatory Skills Discovered & Applied

| Skill Name | Skill Path | Application in Phase 9 Engineering Execution |
| :--- | :--- | :--- |
| **`nextjs-fullstack-architecture`** | `C:\Users\alexc\.gemini\config\skills\nextjs-fullstack-architecture\SKILL.md` | Standardized App Router endpoints under `/api/v1/payments/razorpay/*`, server/client component boundaries for checkout modal, and dynamic policy routes (`/privacy-policy`, etc.) with ISR revalidation. |
| **`security-auditing-and-owasp`** | `C:\Users\alexc\.gemini\config\skills\security-auditing-and-owasp\SKILL.md` | Versioned AES-256-GCM envelope (`v1$iv$authTag$cipher`), constant-time HMAC-SHA256 signature verification, SSRF prevention on diagnostic probes (hardcoded URL, no redirects, 5s timeout), Super Admin RBAC. |
| **`playwright-and-qa-automation`** | `C:\Users\alexc\.gemini\config\skills\playwright-and-qa-automation\SKILL.md` | End-to-end browser automation validating storefront checkout, Razorpay standard modal launch, payment failure injection, responsive viewports (Desktop 1920px, Tablet 768px, Mobile 390px), screenshot captures under `artifacts/phase-9-browser-verification/`. |
| **`clean-architecture`** | `C:\Users\alexc\.gemini\config\skills\clean-architecture\SKILL.md` | Strict decoupling of Razorpay service layers (`RazorpayPaymentService`, `PaymentGatewayConfigService`), domain validation, repository persistence, and API route handlers. |
| **`cms-and-content-platform`** | `C:\Users\alexc\.gemini\config\skills\cms-and-content-platform\SKILL.md` | Integration of PostgreSQL-backed CMS schema (`cms_page`, `cms_block`, `cms_revision`), publishing lifecycle states, draft previews, and legal content protection. |
| **`clean-code-and-refactoring`** | `C:\Users\alexc\.gemini\config\skills\clean-code-and-refactoring\SKILL.md` | Systematic, non-destructive decommissioning of Cashfree across 21 active production files while preserving 100% of historical transactions immutable. |
| **`postgresql-and-supabase`** | `C:\Users\alexc\.gemini\config\skills\postgresql-and-supabase\SKILL.md` | Additive DDL migrations for `payment_gateway_config`, `payment_webhook_log` (90-day retention, statutory hold), and `payment_refund` with strict unique constraints and foreign keys. |
| **`api-design-and-security`** | `C:\Users\alexc\.gemini\config\skills\api-design-and-security\SKILL.md` | RESTful route handlers with strict request validation, idempotency guards, proper HTTP status codes, and sanitized responses preventing credential/stack-trace leakage. |
| **`smart-coder`** | `C:\Users\alexc\.gemini\config\skills\smart-coder\SKILL.md` | Architecture-aware investigation: identified legal entity discrepancy (Proprietorship vs Pvt Ltd) without breaking verbatim text, ensured full capture invariant before marking order paid. |
| **`lazy-coder`** | `C:\Users\alexc\.gemini\config\skills\lazy-coder\SKILL.md` | Reused existing accounting engine (`accounting_voucher`, `accounting_account`), database pool, and UI components without redundant wheel-reinvention. |

