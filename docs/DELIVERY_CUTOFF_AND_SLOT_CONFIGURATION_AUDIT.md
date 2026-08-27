# CakeToHome — Delivery Cutoff & Time-Slot Availability Audit

## 1. Executive Summary & Root Cause Analysis

### Problem Observed
In previous checkout revisions, customer sessions could view and select same-day evening delivery slots (e.g. `08:00 PM - 09:00 PM`, `09:00 PM - 10:00 PM`, `10:00 PM - 11:00 PM`, and `Midnight Surprise Delivery 11:30 PM - 12:05 AM`) even after the corporate same-day order acceptance cutoff (e.g. 6:00 PM IST) had passed. Customers were allowed to proceed to checkout Step 3 (Review & Pay), resulting in kitchen dispatch violations or delayed order rejections at the payment gateway.

### Root Causes Identified
1. **Frontend Fallback Duplication**: `deliveries.ts` had hardcoded static time slots that bypassed the central fulfillment configuration when API calls failed or initialized before store hydration.
2. **Deterministic Filter Omission**: The slot generator skipped unavailable slots rather than returning them with explicit statuses (`PAST_CUTOFF`, `PREP_TIME_EXCEEDED`, `FULL`, `CLOSED`, `DISABLED`) and user-facing explanatory reason messages.
3. **Hardcoded Special Slots**: Midnight Surprise Delivery (`11:30 PM - 12:05 AM`, ₹199) and Hyperlocal Express Delivery (`Express 45-Min`, ₹99) were statically appended at the bottom of the slot array instead of being dynamically generated from system configuration with cutoff flags (`subject_to_corporate_cutoff`, `special_order_cutoff`).
4. **Checkout Step Validation Gap**: Step 2 validation in `checkout-form.tsx` only verified that `delivery_slot_id` was non-empty, without asserting that `selectedSlot.available === true`.
5. **Lack of Server Authoritative Revalidation**: The server-side `validateCheckout` and `confirmCheckout` handlers did not revalidate slot availability against the authoritative Indian Standard Time (`Asia/Kolkata`) clock at checkout submission time, allowing stale checkout sessions to place invalid same-day orders.

---

## 2. Architectural Architecture & Configuration Hierarchy

The delivery availability engine enforces a strict configuration precedence hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│       1. CORPORATE SAME-DAY ACCEPTANCE CUTOFF (Hard)       │
│    (Global Default: 18:00 IST / Emergency Override Flag)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          2. STORE / BRANCH OPERATIONAL SCHEDULE             │
│   (Weekly Schedule, Operating Windows, Kitchen Holiday)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             3. DELIVERY ZONE LOGISTICS RULES                │
│    (Serviceable Pincodes, Polygons, Hyperlocal Geo-Fence)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          4. PRODUCT PREPARATION & LEAD TIME BUFFER          │
│    (Prep Time Mins + Dispatch Buffer + Minimum Lead Days)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│         5. REAL-TIME SLOT CAPACITY & BOOKING COUNTS         │
│     (Max Slots Per Window vs. Booked Orders Row-Lock)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technical Implementation Details

### A. Core Types & Configuration Models (`src/lib/fulfillment/types.ts`)
- **`LateNightDeliveryConfig`**: Configurable start/end times (`23:30` to `00:05`), surcharge (`₹199`), `subject_to_corporate_cutoff` (boolean), and `special_order_cutoff` (optional string `HH:MM`).
- **`ExpressDeliveryConfig`**: Configurable operational window (`09:00` to `21:00`), surcharge (`₹99`), `subject_to_corporate_cutoff` (boolean), and `special_order_cutoff` (optional string `HH:MM`).
- **Window Boundaries**: `earliest_delivery_time` (`09:00`), `latest_delivery_slot_start` (`21:00`), `latest_delivery_slot_end` (`22:00`).
- **Canonical Reason Codes**: `CORPORATE_CUTOFF_PASSED`, `SPECIAL_CUTOFF_PASSED`, `PRODUCT_PREP_TIME`, `SLOT_CAPACITY_FULL`, `SPECIAL_DELIVERY_DISABLED`, `STALE_CHECKOUT`.
- **Timezone Utilities**: `timeStringToMinutesWithCrossing` accurately computes midnight-crossing durations (e.g. `23:30` = 1410 min to `00:05` = 1445 min / +35 min duration across calendar day boundaries).

### B. Deterministic Slot Generator (`src/lib/fulfillment/delivery-slot-generator.ts`)
- Computes standard hourly slots between `earliest_delivery_time` and `latest_delivery_slot_end`.
- Returns structured `DeliverySlot` objects containing:
  - `available`: `true | false`
  - `status`: `"AVAILABLE" | "PAST_CUTOFF" | "PREP_TIME_EXCEEDED" | "FULL" | "CLOSED" | "DISABLED"`
  - `reason_code`: Canonical error code for analytics and client error handling.
  - `reason_message`: Customer-facing human readable message explaining why a slot cannot be booked.
- Generates Special Slots (Express & Midnight) strictly according to active configuration rules.

### C. Storefront Checkout UI Hardening (`src/components/store/checkout/checkout-form.tsx`)
- **Step 2 Gate**: `isStep2Valid` requires `selectedSlot?.available === true`.
- **Interactive States**: Unavailable slots are rendered with `opacity-50 cursor-not-allowed` and `disabled={!isAvailable}`.
- **Visual Feedback**: Badges render real-time state:
  - 🔴 `Cutoff Passed`
  - 🟠 `Prep Time Exceeded`
  - 🔴 `Fully Booked`
  - ⚪ `Kitchen Closed`
- **Same-Day Ordering Closed Banner**: When all same-day slots have passed cutoff, an alert banner displays the cutoff time and offers a 1-click button to switch to tomorrow.
- **CTA Protection**: The "Continue to Review & Pay →" button is locked when an expired slot is selected.

### D. Admin Dashboard Configuration Controls (`src/components/dashboard/admin/fulfillment-config-panel.tsx`)
- Configures Earliest/Latest delivery windows (`09:00` to `22:00`).
- Configures Late-Night / Midnight Delivery with granular toggle for `Subject to Corporate Cutoff` and custom `Special Midnight Cutoff Time`.
- Configures Emergency Corporate Override with reason tracking and expiration timestamps.

### E. Server-Side Authoritative Revalidation (`src/lib/api-engine.ts`)
- `ApiEngine.validateCheckout` performs real-time slot and corporate cutoff revalidation against Indian Standard Time.
- Rejects missing, invalid, or expired slots with HTTP 400 and canonical reason codes (`CORPORATE_CUTOFF_PASSED`, `INVALID_TIME_SLOT`, etc.).
- `ApiEngine.confirmCheckout` re-executes `validateCheckout` before transaction commit to eliminate race conditions and stale checkout bypasses.

---

## 4. Automated Verification Matrix (20/20 Test Cases)

| Test ID | Test Scenario Description | Expected Outcome | Verification Status |
|---|---|---|---|
| **T01** | Standard slot 8:00-9:00 PM evaluated at 2:00 PM (before 18:00 cutoff) | Available (`available: true`, `status: "AVAILABLE"`) | ✅ PASS |
| **T02** | Same-day standard slots evaluated at 18:30 (after 18:00 cutoff) | Blocked (`available: false`, `status: "PAST_CUTOFF"`, `reason: CORPORATE_CUTOFF_PASSED`) | ✅ PASS |
| **T03** | Midnight Surprise evaluated at 18:30 with `subject_to_corporate_cutoff = true` | Blocked (`available: false`, `reason: CORPORATE_CUTOFF_PASSED`) | ✅ PASS |
| **T04** | Midnight Surprise evaluated at 18:30 with `special_order_cutoff = "21:30"` | Available (`available: true`, `status: "AVAILABLE"`) | ✅ PASS |
| **T05** | Midnight Surprise evaluated at 21:45 with `special_order_cutoff = "21:30"` | Blocked (`available: false`, `reason: SPECIAL_CUTOFF_PASSED`) | ✅ PASS |
| **T06** | 11:00 AM slot evaluated at 10:45 AM with 60m prep + 30m buffer | Blocked (`available: false`, `status: "PREP_TIME_EXCEEDED"`) | ✅ PASS |
| **T07** | 1:00 PM slot evaluated at 10:45 AM with 60m prep + 30m buffer | Available (`available: true`, `status: "AVAILABLE"`) | ✅ PASS |
| **T08** | Slot with 15/15 capacity booked | Blocked (`available: false`, `status: "FULL"`, `remaining_capacity: 0`) | ✅ PASS |
| **T09** | Emergency corporate cutoff override active to 20:30 evaluated at 18:30 | Available (`available: true`, `status: "AVAILABLE"`) | ✅ PASS |
| **T10** | Tomorrow 10:00 AM slot evaluated at 23:00 today (today's cutoff passed) | Available (`available: true`, completely isolated from today's cutoff) | ✅ PASS |
| **T11** | Midnight crossing math `23:30` to `00:05` | 1410 min to 1445 min (+35 min duration with day wrap) | ✅ PASS |
| **T12** | `ApiEngine.getDeliverySlots` returns structured slot list with status | Valid structured slot array returned | ✅ PASS |
| **T13** | Express delivery slot surcharge verification | Configurable surcharge `₹99` returned | ✅ PASS |
| **T14** | Midnight delivery slot surcharge verification | Configurable surcharge `₹199` returned | ✅ PASS |
| **T15** | `ApiEngine.validateCheckout` with valid future date and slot | Validation passes (`valid: true`) | ✅ PASS |
| **T16** | `ApiEngine.validateCheckout` with empty delivery slot ID | Rejected with `DELIVERY_SLOT_REQUIRED` | ✅ PASS |
| **T17** | `ApiEngine.validateCheckout` with non-existent slot ID | Rejected with `INVALID_TIME_SLOT` | ✅ PASS |
| **T18** | Stale checkout session simulation (cutoff passed during checkout) | Rejected with `CORPORATE_CUTOFF_PASSED` | ✅ PASS |
| **T19** | `ApiEngine.confirmCheckout` server revalidation on stale slot | Order rejected with HTTP 400 | ✅ PASS |
| **T20** | `FulfillmentEngine.calculateCartEligibility` after cutoff | Cart marked ineligible with `CORPORATE_CUTOFF_PASSED` | ✅ PASS |

---

## 5. Deployment & Operational Checklist

- [x] **Zero TypeScript Errors**: Verified via `npx tsc --noEmit` (`100% PASS`).
- [x] **Full Test Suite Coverage**: Verified via `scripts/test-delivery-cutoff-slots.ts` (`20/20 PASS`).
- [x] **Production Build Clean**: Next.js App Router build compiles cleanly.
- [x] **Bakery First Rule**: Protects kitchen operations from late unfulfillable orders while maximizing daytime pre-orders.
