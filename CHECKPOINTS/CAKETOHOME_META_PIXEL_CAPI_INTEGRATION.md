# CakeToHome — Meta Pixel & Conversions API (CAPI) Integration Architecture

**Document Reference:** `CHECKPOINTS/CAKETOHOME_META_PIXEL_CAPI_INTEGRATION.md`  
**Execution Date:** 2026-11-11  
**Lead Engineer:** Principal Software Architect & Full-Stack Systems Engineer  
**Status:** **IMPLEMENTED & VERIFIED (5 / 5 Tests Passed — 100%)**  
**Components:**
- Client-Side Meta Pixel: `frontend/src/components/marketing/meta-pixel.tsx`
- Root Layout Integration: `frontend/src/app/layout.tsx` (Suspense-wrapped)
- Server-Side CAPI Engine: `frontend/src/lib/services/meta-capi.service.ts`
- CAPI Route Handler: `frontend/src/app/api/v1/integrations/meta/capi/route.ts`
- Razorpay Payment Hook: `frontend/src/app/api/v1/payments/razorpay/verify/route.ts`

---

## 1. Executive Summary

CakeToHome now implements an omnichannel marketing and conversion tracking architecture that pairs client-side Meta Pixel (`fbq`) with server-side Meta Conversions API (CAPI). The implementation enforces:

1. **Deterministic Deduplication:** Matching `event_id` keys (e.g. `purchase_${order_id}`) shared between browser pixel and server CAPI, allowing Meta's event processing pipeline to discard duplicates while maximizing event match quality.
2. **Privacy Compliance & PII Normalization:** All user identification fields (email, phone, address fields) undergo standard trim, lowercase normalization, non-digit stripping, and SHA-256 hashing before transmission.
3. **Resilience & Zero Blast Radius:** All CAPI calls run asynchronously with non-blocking error handling. If Meta's Graph API is down, slow, or unconfigured, payment confirmations, inventory deductions, and order fulfillment remain 100% unaffected.
4. **Suspense Isolation:** The client-side `<MetaPixel />` route observer is wrapped in React `<Suspense fallback={null}>` within `RootLayout`, ensuring that static page optimization across Next.js 14 App Router remains unhindered.

---

## 2. Architecture & Data Flow

```
[ Customer Browser ]
        │
        ├─ 1. Client Event: fbq('track', 'Purchase', { ... }, { eventID: 'purchase_ORD123' })
        │
        ▼
[ Next.js API: /api/v1/payments/razorpay/verify ]
        │
        ├─ 2. HMAC-SHA256 Signature Verification & DB Ledger Commit (Status: paid)
        │
        ▼
[ MetaCapiService.sendPurchase ]
        │
        ├─ 3. Normalize & SHA-256 Hash PII (email, phone)
        │
        ├─ 4. Non-blocking POST to Meta Graph API v19.0:
        │     Endpoint: https://graph.facebook.com/v19.0/{PIXEL_ID}/events
        │     Payload: { data: [{ event_name: 'Purchase', event_id: 'purchase_ORD123', ... }] }
        │
        ▼
[ Meta Event Processing Pipeline ]
        │
        └─ 5. Deduplication via event_id -> Single Attributed Purchase Record
```

---

## 3. Configuration & Environment Variables

The integration operates out-of-the-box in local, staging, and production environments without throwing runtime exceptions when marketing tokens are unset:

| Variable | Scope | Purpose | Fallback / Behavior if Unset |
|---|---|---|---|
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Client & Server | Meta Pixel Identifier | Silently disables script injection; returns `null` |
| `FB_CAPI_ACCESS_TOKEN` | Server-Only | Meta Graph API Access Token | Returns `{ status: 'skipped_no_token' }` gracefully |
| `META_CONVERSIONS_API_TOKEN` | Server-Only | Alternate CAPI Token Alias | Checked if `FB_CAPI_ACCESS_TOKEN` is unset |

---

## 4. Verification & Test Evidence

Test harness `scratch/test_meta_pixel_capi.cjs` validated all functionality:

| Test ID | Objective | Expected Result | Observed Result | Status |
|---|---|---|---|---|
| **TEST 1** | CAPI Server Endpoint (`/api/v1/integrations/meta/capi`) | HTTP 200 with matching `eventId` | HTTP 200, `eventId: purchase_ord_meta_...` | **PASS** |
| **TEST 2** | CAPI Validation (Missing fields) | HTTP 400 `MISSING_REQUIRED_FIELDS` | HTTP 400 | **PASS** |
| **TEST 3** | Email Normalization & SHA-256 Hashing | Lowercase trim SHA-256 | Exact cryptographic match | **PASS** |
| **TEST 4** | Phone Normalization & Hashing | Non-digit strip & SHA-256 | Exact cryptographic match | **PASS** |
| **TEST 5** | Storefront HTML Page Rendering | HTTP 200 HTML with Suspense | HTTP 200, clean render | **PASS** |

Test Output:
```text
================================================================
CAKETOHOME — META PIXEL & CONVERSIONS API (CAPI) TEST SUITE
================================================================

[PASS 1] ✅ CAPI route returns HTTP 200 with matching eventId and safe status
[PASS 2] ✅ CAPI route rejects requests missing required fields with HTTP 400
[PASS 3] ✅ Customer email is normalized to lowercase and SHA-256 hashed according to Meta standards
[PASS 4] ✅ Customer phone number strips non-digits before SHA-256 hashing
[PASS 5] ✅ Storefront home page renders successfully with Suspense-isolated Meta Pixel

================================================================
META PIXEL & CAPI SUITE: 5 / 5 PASSED (100%)
================================================================
```

---

## 5. Gate Status

- **Gate 8 (M1 Meta Pixel & Conversions API):** **PASSED & VERIFIED**
- **Deduplication Strategy:** Enforced via `purchase_${order_id}`
- **Security & Privacy:** PII SHA-256 hashed, server tokens isolated from client bundle

