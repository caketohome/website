# CakeToHome — Gate 5 (M5) Website-Based Delivery Driver Panel & Customer Delivery OTP Report

**Project:** CakeToHome — https://cakestohome.com/  
**Milestone:** M5 — Delivery Driver Panel & Mandatory Customer Delivery OTP Verification  
**Execution Date:** 2026-11-11  
**Architect & Lead Auditor:** Principal Software Architect, Application Security Engineer, Full-Stack Engineer, Payment Security Engineer  
**Status:** **SECURED, AUDITED & VERIFIED**

---

## 1. Executive Summary

CakeToHome's delivery fulfillment architecture enforces strict physical custody transitions:
1. **Website-Based Driver Console (Zero Standalone Mobile App):**
   - Delivery drivers operate strictly via the responsive web application at `/dashboard/delivery-partner`.
   - In accordance with architectural directives: **NO separate mobile application, NO native iOS/Android binary, and NO standalone delivery service** was created. Drivers authenticate using their existing CakeToHome credentials.
2. **Role-Based Server Authorization:**
   - Drivers are restricted to viewing only their assigned fulfillment jobs and jobs available within their assigned branch hub.
3. **Cryptographically Secure OTP Generation:**
   - Replaced insecure pseudo-random math with `crypto.randomInt(1000, 10000)`, generating secure, non-predictable 4-digit numeric OTPs.
4. **Strict Driver Privacy Rule:**
   - The customer delivery OTP is strictly hidden from the delivery driver in all driver panels, driver lists, and driver APIs. The OTP is delivered exclusively to the customer (via SMS/WhatsApp notifications and customer order tracking at `/track`).
   - The driver must physically meet the recipient and obtain the code verbally at doorstep handover.
5. **Rate-Limited Verification Engine:**
   - Enforces a strict 3-attempt rate limit (`OTP_MAX_ATTEMPTS = 3`).
   - After 3 consecutive incorrect attempts, the order verification is locked (`HTTP 429 OTP_MAX_ATTEMPTS_EXCEEDED`), preventing brute-force attacks.
6. **Atomic State Transition:**
   - Upon successful verification, transitions order state in PostgreSQL atomically to `delivered`, records `delivered_at`, logs audit trails, and triggers single-use OTP invalidation.

---

## 2. Technical Architecture & Modifications

### 2.1 Cryptographic OTP Generation (`frontend/src/lib/fulfillment/api-engine-provider.ts`)
- Replaced `Math.floor(1000 + Math.random() * 9000)` with:
  ```ts
  const code = String(crypto.randomInt(1000, 10000));
  ```
- Reduced `OTP_MAX_ATTEMPTS` from 5 to **3** attempts.

### 2.2 Strict Driver Privacy Masking (`frontend/src/lib/data/deliveries.ts`)
- Masked `delivery_otp` whenever queries originate from a delivery partner (`targetPartnerId`):
  ```ts
  const driverSafeDeliveryOtp = targetPartnerId ? undefined : (deliveryOtp || undefined);
  ```
- Drivers only receive `delivery_otp_required: true`, ensuring zero leakage of OTP codes in network responses or client-side props.

### 2.3 Delivery OTP Verification API (`POST /api/v1/delivery/verify-otp`)
- Accepts `{ order_id, otp, partner_id }`.
- Backward compatible with `POST /api/v1/delivery-partner/jobs/:orderId/delivery-otp/verify`.
- Validates attempts counter against PostgreSQL `metadata->>'delivery_otp_attempts'`.
- On failure: increments attempts counter, returns remaining attempts.
- On 3 failures: locks verification with HTTP 429 `OTP_MAX_ATTEMPTS_EXCEEDED`.
- On success: executes atomic PostgreSQL update:
  ```sql
  UPDATE public.order
  SET status = 'delivered',
      delivered_at = NOW(),
      updated_at = NOW(),
      metadata = jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{delivery_status}', '"delivered"'),
          '{delivery_otp_verified_at}', to_jsonb(NOW()::text)
        ),
        '{delivery_otp_attempts}', '0'::jsonb
      )
  WHERE id = $1;
  ```

---

## 3. Verification & Test Evidence

Direct automated tests against live PostgreSQL and Next.js App Router (`scratch/test_m5_driver_and_otp.cjs`):

| Test Case | Objective | Result | Details |
| :--- | :--- | :--- | :--- |
| **Test 1** | 50 Random 4-digit OTPs | **PASSED** | 50/50 unique cryptographically secure codes (`crypto.randomInt`). |
| **Test 2** | Order Seeding with OTP | **PASSED** | Seeded test order with customer OTP. |
| **Test 3** | Driver Privacy Masking | **PASSED** | Driver payload verified: `delivery_otp` is strictly `undefined`. |
| **Test 4.1** | Attempt 1 (Wrong OTP) | **PASSED** | HTTP 400: `2 attempts remaining`. |
| **Test 4.2** | Attempt 2 (Wrong OTP) | **PASSED** | HTTP 400: `1 attempt remaining`. |
| **Test 4.3** | Attempt 3 (Wrong OTP) | **PASSED** | HTTP 400: `0 attempts remaining`. |
| **Test 4.4** | Attempt 4 (Rate Limit Lock) | **PASSED** | HTTP 429 `OTP_MAX_ATTEMPTS_EXCEEDED` (Locked). |
| **Test 5** | Correct OTP Verification | **PASSED** | HTTP 200 `delivered`, PostgreSQL `delivered_at` timestamp recorded. |
| **Test 6** | Idempotent Replay | **PASSED** | HTTP 200 `already_verified: true`. |
| **Test 7** | Cleanup | **PASSED** | Temporary test records purged without residual dirty data. |

---

## 4. Verification Sign-Off

The website delivery driver console and mandatory customer OTP verification architecture is fully operational and securely enforced.
