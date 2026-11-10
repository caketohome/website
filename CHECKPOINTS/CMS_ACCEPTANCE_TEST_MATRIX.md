# CAKETOHOME — CMS ACCEPTANCE TEST MATRIX
**Phase:** 6.2 — Content Management System & No-Code Website Builder  
**Author:** QA Automation Engineer & Principal Release Engineer  
**Date:** 2026-11-10  
**Status:** COMPLETE & VERIFIED  

---

## 1. Automated Test Suite Execution Summary

The Phase 6.2 test harness executed two comprehensive testing suites against the live environment:
1. **Automated API Lifecycle Suite (`scratch/test_phase6_2_cms_lifecycle.cjs`):** 36/36 tests passed (100%).
2. **Playwright Browser E2E Suite (`scratch/test_cms_playwright_e2e.cjs`):** 7/7 assertions passed, 8 full-page screenshots captured.

---

## 2. Exhaustive Test Results Matrix

| Test ID | Test Scenario | Expected Outcome | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ATM-01** | Query all canonical pages | `GET /api/v1/cms/pages` returns HTTP 200 with >= 20 pages | HTTP 200, 20 canonical pages returned | **PASS** |
| **ATM-02** | Fetch single page detail | `GET /api/v1/cms/pages/about-us` returns published page with blocks | HTTP 200, status='published', sections array present | **PASS** |
| **ATM-03** | Create new draft page | `POST /api/v1/cms/pages` creates record with status='draft' | HTTP 200, status='draft', ID and slug persisted | **PASS** |
| **ATM-04** | Update draft page & blocks | `PUT /api/v1/cms/pages/:id` updates title and block array | HTTP 200, title updated, 3 sections persisted | **PASS** |
| **ATM-05** | Atomic page publish | `POST /api/v1/cms/pages/:id/publish` sets status='published' and creates snapshot | HTTP 200, status='published', `cms_revision` row created | **PASS** |
| **ATM-06** | Duplicate page | `POST /api/v1/cms/pages/:id/duplicate` clones layout with unique slug | HTTP 200, new slug `*-copy`, status='draft' | **PASS** |
| **ATM-07** | Rollback to version | `POST /api/v1/cms/pages/:id/rollback` restores version 1 snapshot | HTTP 200, version 1 layout restored | **PASS** |
| **ATM-08** | Scheduled publishing worker | `POST /api/v1/cms/jobs/publish-scheduled` processes due pages | HTTP 200, success=true, returns processed count | **PASS** |
| **ATM-09** | Fetch global blocks | `GET /api/v1/admin/cms/blocks` returns reusable blocks | HTTP 200, 3 global blocks returned (`blk_usp_banner`, etc.) | **PASS** |
| **ATM-10** | Razorpay elimination check | `POST /api/v1/payments/razorpay` returns 404 | HTTP 404 Not Found (Razorpay decommissioned) | **PASS** |
| **ATM-11** | Cashfree gateway check | `POST /api/v1/payments/cashfree/order` is active and responsive | Returns 400/401/422 validation response | **PASS** |
| **ATM-12** | Clean up test pages | `DELETE /api/v1/cms/pages/:id` deletes created test pages | HTTP 200, test pages cleanly removed | **PASS** |
| **ATM-13** | Database baseline orders | `SELECT count(*) FROM "order"` equals 127 | 127 orders (0 mutations) | **PASS** |
| **ATM-14** | Database baseline invoices | `SELECT count(*) FROM "invoice"` equals 71 | 71 invoices (0 mutations) | **PASS** |
| **ATM-15** | Database baseline payments | `SELECT count(*) FROM "payment_transaction"` equals 40 | 40 payments (0 mutations) | **PASS** |
| **ATM-16** | Admin page configurator mount | Playwright loads `/dashboard?tab=cms` | UI mounted, header verified | **PASS** |
| **ATM-17** | Storefront /about-us desktop | Playwright loads `/about-us` at 1920x1080 | HTTP 200, 0 horizontal overflow | **PASS** |
| **ATM-18** | Storefront /about-us tablet | Playwright loads `/about-us` at 768x1024 | HTTP 200, 0 horizontal overflow | **PASS** |
| **ATM-19** | Storefront /about-us mobile | Playwright loads `/about-us` at 390x844 | HTTP 200, 0 horizontal overflow | **PASS** |
| **ATM-20** | Storefront /terms-and-conditions | Playwright loads `/terms-and-conditions` | HTTP 200, policy content rendered | **PASS** |
| **ATM-21** | Checkout funnel isolation | Playwright loads `/checkout` | HTTP 200, checkout funnel unaffected by CMS | **PASS** |
