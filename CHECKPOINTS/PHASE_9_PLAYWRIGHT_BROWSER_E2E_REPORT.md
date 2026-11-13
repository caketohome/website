# CAKETOHOME — PHASE 9 PLAYWRIGHT BROWSER E2E REPORT
**Platform:** CakeToHome (https://cakestohome.com/)  
**Test Harness:** Playwright (Chromium Headless)  
**QA Lead:** Lead QA Automation Engineer  
**Date:** 2026-11-10  

---

## 1. Executive Summary

A real Playwright browser verification suite (`scratch/run_phase9_real_e2e_suite.cjs`) was executed against the running Next.js application (Port 3000) and PostgreSQL database (Port 5433).

- **Total Viewports:** 3 (Desktop 1920x1080, Tablet 768x1024, Mobile 390x844)
- **Total Screenshots Captured:** 16
- **Test Pass Rate:** **100% (16/16)**
- **`ORDER_NOT_FOUND` Error Count:** **0**

---

## 2. Screenshot Manifest & Verification Results

| Screenshot File | Viewport | Target Route / State | Verification Assertion | Status |
| :--- | :--- | :--- | :--- | :--- |
| `01-storefront-home-desktop.png` | 1920x1080 | `/` (Home) | Festive Celebration banner renders, no Monsoon claims | **PASSED** |
| `02-storefront-footer-policies-desktop.png` | 1920x1080 | `/` (Footer) | All 12 legal policy links visible in blue footer | **PASSED** |
| `03-checkout-page-razorpay-selected-desktop.png` | 1920x1080 | `/checkout` | Razorpay selected, Cashfree decommissioned notice | **PASSED** |
| `04-razorpay-checkout-modal-page-desktop.png` | 1920x1080 | `/checkout/razorpay?order_id=CTH-ORD-xxx` | **Payable Amount ₹699.00 renders cleanly; ZERO ORDER_NOT_FOUND error** | **PASSED** |
| `05-payment-failure-injection-desktop.png` | 1920x1080 | `/checkout/razorpay?order_id=NON_EXISTENT` | Graceful Order Recovery card rendered with "Return to Checkout" | **PASSED** |
| `06-order-live-status-confirmed-desktop.png` | 1920x1080 | `/your-order?order_id=CTH-ORD-xxx` | Order Confirmed & Paid status rendered with item details | **PASSED** |
| `07-admin-payment-gateway-razorpay-settings-desktop.png` | 1920x1080 | `/dashboard?tab=settings` | **Gate E Live Mode Blocker banner displayed; Live toggle locked** | **PASSED** |
| `08-privacy-policy-desktop.png` | 1920x1080 | `/privacy-policy` | Policy text rendered with brand styling | **PASSED** |
| `09-terms-and-conditions-desktop.png` | 1920x1080 | `/terms-and-conditions` | Terms & conditions text rendered | **PASSED** |
| `10-refund-policy-desktop.png` | 1920x1080 | `/refund-policy` | Refund policy text rendered | **PASSED** |
| `11-contact-information-desktop.png` | 1920x1080 | `/contact-information` | Support contact & grievance info rendered | **PASSED** |
| `12-storefront-home-tablet.png` | 768x1024 | `/` | Tablet responsive layout intact | **PASSED** |
| `13-checkout-page-tablet.png` | 768x1024 | `/checkout` | Tablet checkout layout intact | **PASSED** |
| `14-storefront-home-mobile.png` | 390x844 | `/` | Mobile navigation, header, and banner intact | **PASSED** |
| `15-checkout-page-mobile.png` | 390x844 | `/checkout` | Mobile single-column checkout intact | **PASSED** |
| `16-razorpay-modal-mobile.png` | 390x844 | `/checkout/razorpay` | Mobile checkout portal renders ₹699.00 payment card | **PASSED** |
