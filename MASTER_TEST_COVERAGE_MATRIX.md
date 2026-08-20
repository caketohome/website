# CakeToHome Master Test Coverage Matrix

## Overview
This matrix maps every business and technical domain across CakeToHome to its corresponding automated tests, execution characteristics, real-system dependencies, trusted status, and identified coverage gaps.

---

## Master Domain Coverage Matrix

| Domain | Feature Area | Test File | Test Name / Scope | Test Type | Assertions | Real DB? | Real API? | Real Browser? | External Service | Trusted? | Status | Coverage Gap / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH** | Phone Normalization | `test-master-identity-chain-e2e.ts` | Strips +91, 0, whitespace, hyphens | E2E | 5 | Yes (In-Memory) | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Customer OTP Auth | `test-master-identity-chain-e2e.ts` | Request OTP, Verify OTP, Inline Signup | E2E | 7 | Yes | Yes | No | Mock Dev OTP | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Master Customer Identity | `test-master-identity-chain-e2e.ts` | Deterministic `cth_cus_<phone>` format | E2E | 4 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Guest-to-User Merge | `test-master-identity-chain-e2e.ts` | Cart & Address migration on login | E2E | 4 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Role Resolution & Priority | `test-unified-staff-roles-e2e.ts` | Super Admin, Manager, DLP, Telecaller | Integration | 12 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Staff/Customer Isolation | `test-auth-role-isolation.ts` | Cookie separation (`_cth_role`, `_cth_user_id`) | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AUTH** | Session Invalidation | `test-logout-e2e.ts` | Server-side cookie clearance on logout | E2E | 6 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STAFF** | Store Manager Creation | `test-store-manager-payment-delivery-e2e.ts` | `ensureBranchManagerProfile` provisioning | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STAFF** | Role Conflict Rejection | `test-store-manager-payment-delivery-e2e.ts` | Driver cannot be assigned manager without migration | E2E | 3 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STAFF** | Fine-Grained RBAC | `test-staff-profiles-permissions-e2e.ts` | Access Profiles & Permission Catalog check | Integration | 18 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STAFF** | Multi-Profile Assignment | `test-multi-access-profiles-e2e.ts` | Multi-select profiles on staff accounts | Integration | 10 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STAFF** | Disabled Staff Rejection | `test-unified-staff-roles-e2e.ts` | Inactive staff rejected with 403 Forbidden | Integration | 4 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STORE** | Branch CRUD & Geofencing | `branch.unit.spec.ts`, `test-multicity-e2e.ts` | Operational hours, radius, pincodes | Unit / E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **STORE** | Multi-City Routing | `test-multicity-e2e.ts` | Bangalore, Delhi, Mumbai routing | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **PARTIALLY TESTED** | Bangalore fully tested; Delhi/Mumbai partially simulated |
| **CATALOG** | Product Customization | `test-checkout-verification.ts` | artisan, weight (kg), shape, message, card | E2E | 10 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CATALOG** | Delivery Lead Time & Cutoff | `test-product-delivery-restrictions.ts` | 4-hr prep window, midnight delivery gate | Integration | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CATALOG** | PIM Category Hierarchy | `pim-categories.spec.ts` | Category CRUD, slugs, parent mapping | Browser | 6 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CHECKOUT** | Price Tampering Gate | `test-checkout-verification.ts` | Server-side price recalculation against catalog | E2E | 5 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CHECKOUT** | Statutory GST Calculation | `test-checkout-verification.ts` | HSN 19059090 (CGST 9% + SGST 9% = 18%) | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CHECKOUT** | Coupon Exclusivity | `enterprise-coupon.unit.spec.ts`, `order-flow.spec.ts` | Prevents stacking incompatible coupons | Unit / Browser | 5 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **PAYMENT** | Authoritative Payment Gate | `test-store-manager-payment-delivery-e2e.ts` | `isPaymentConfirmed` excludes unpaid online orders | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **PAYMENT** | Razorpay Signature Validation | `payment-acceptance.integration.spec.ts` | HMAC-SHA256 signature verification | Integration | 4 | Yes | Yes | No | Razorpay Mock | **TRUSTED** | **PARTIALLY TESTED** | Sandbox/mock tested; live gateway requires live keys |
| **ORDERS** | Kitchen Queue & KOT | `test-store-manager-payment-delivery-e2e.ts` | Preparing $\rightarrow$ Ready for Pickup | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **DELIVERY** | Kitchen Pickup OTP Gate | `test-store-manager-payment-delivery-e2e.ts` | 4-digit store dispatch handover verification | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **DELIVERY** | Customer Doorstep OTP Gate | `test-store-manager-payment-delivery-e2e.ts` | 4-digit doorstep delivery handover | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **DELIVERY** | Driver Store Isolation | `test-store-manager-payment-delivery-e2e.ts` | Hub A driver cannot query/claim Hub B jobs | E2E | 5 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **DELIVERY** | Idempotent Claim | `test-store-manager-payment-delivery-e2e.ts` | Repeat claim returns 200 `already_claimed: true` | E2E | 4 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CRM** | Customer 360 & RFM Scoring | `test-crm-complete-engine-e2e.ts` | RFM derivation, VIP / At-Risk tiers | E2E | 14 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **CRM** | Duplicate Detection & Merge | `test-crm-complete-engine-e2e.ts` | Safe record merge without data loss | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **RECOVERY** | Abandoned Cart Ingestion | `test-smart-login-cart-recovery-e2e.ts` | 15-min idle detection & token generation | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **RECOVERY** | Multi-Channel Recovery | `test-smart-login-cart-recovery-e2e.ts` | WhatsApp recovery link restoration & conversion | E2E | 6 | Yes | Yes | No | Mock WhatsApp | **TRUSTED** | **PARTIALLY TESTED** | Dispatch logic tested; live Twilio/Gupshup SMS mocked |
| **TELEMARKETING**| Reorder Opportunity Scoring | `test-telemarketing-reorder-engine-e2e.ts` | Candidate score, days since last order | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **TELEMARKETING**| Telecaller Assignment & Call Log | `test-telemarketing-reorder-engine-e2e.ts` | Agent assignment, call outcomes, notes | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **TELEMARKETING**| Outreach Order Linking | `test-outreach-order-linking-e2e.ts` | Attributing reorders to telecaller campaign | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **WEBHOOKS** | Canonical Event Envelope | `test-n8n-outbox-complete-e2e.ts` | Zero PII leak sanitization (password/cvv stripped) | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **WEBHOOKS** | HMAC-SHA256 Request Signing | `test-n8n-outbox-complete-e2e.ts` | Timing-safe crypto verification & clock-skew | E2E | 6 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **WEBHOOKS** | Outbox Worker & DLQ | `test-n8n-outbox-complete-e2e.ts` | Exponential backoff, retry limit, DLQ replay | E2E | 8 | Yes | Yes | No | None | **TRUSTED** | **TESTED** | Complete coverage |
| **WEBHOOKS** | n8n Webhook Integration | `test-n8n-outbox-complete-e2e.ts` | 2-stage callback recording (accepted vs processed) | E2E | 6 | Yes | Yes | No | Mock n8n receiver | **TRUSTED** | **PARTIALLY TESTED** | Outbox and callback engine tested; live n8n cloud mocked |
| **MARKETING** | Exit Intent & Popup Triggers | `test-popup-complete-engine-e2e.ts` | Mouse leave, scroll depth, session frequency | Browser | 12 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **ANIMATION** | Scroll Hero 22 Frames | `test-scroll-frame-hero-22-e2e.ts` | 1 canvas instance, frames 1-22 clamping, 7 viewports | Browser | 10 | Yes | No | Yes (Playwright) | Cloudinary CDN | **TRUSTED** | **TESTED** | Complete coverage |
| **REPORTS** | GST 11 Reports Excel Export | `test-all-11-gst-reports-browser.ts` | HSN 19059090, GSTR-1, GSTR-3B Excel sheets | Browser / Export | 11 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **REPORTS** | Analytics 16 Reports | `test-all-16-reports-browser-download.ts` | Sales, revenue, hourly, driver performance | Browser / Export | 16 | Yes | Yes | Yes (Playwright) | None | **TRUSTED** | **TESTED** | Complete coverage |
| **AI** | Cake Sommelier Concierge | `test-ai-concierge-e2e.ts` | Intent detection, flavor ranking, inline cart action | Integration | 8 | Yes | Yes | No | Local AI Engine | **TRUSTED** | **TESTED** | Complete coverage |
| **SEARCH** | Voice Search Stream | N/A | Web Audio API stream recognition | N/A | 0 | No | No | No | None | **N/A** | **NOT TESTED** | Audio stream processing is not covered by tests |
| **MEDIA** | Live Cloudinary Upload | `test-cloudinary-frames.ts` | Frame URL derivation & image verification | Integration | 4 | No | Yes | No | Cloudinary CDN | **PARTIALLY TESTED** | Frame retrieval tested; admin file upload to live CDN mocked |
