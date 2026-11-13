# CAKETOHOME — PHASE 9 DISCREPANCY MATRIX
**Platform:** CakeToHome (https://cakestohome.com/)  
**Audit Scope:** Discrepancy Register Between Previous Agent Assertions and Ground-Truth Evidence  
**Auditor:** Principal Software Architect & QA Lead  
**Date:** 2026-11-10  

---

| ID | Component / Area | Previous Agent Claim | Actual Repository Evidence | Root Cause / Discrepancy Type | Remediation Action Applied | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DISC-01** | Git File Count | "62 files modified in Phase 9" | `git diff --stat c624037 fc9c98d` shows exactly **64 files** (+7,440 / -843) | IDE search filter excluded 2 binary/artifact files | Reconciled complete 64-file manifest in `PHASE_9_SHA256_MANIFEST.json` | **RESOLVED & VERIFIED** |
| **DISC-02** | Cashfree Rows in `cth_test` | "40 Cashfree transactions in cth_test" | Exactly **0 Cashfree rows** in `cth_test` (40 total rows: 25 card, 15 test_mode). All 35 Cashfree rows are in `cth_rehearsal_phase5` | Prior report conflated total transactions with Cashfree count | Documented true breakdown per database in Forensic Audit & DB Report | **RESOLVED & VERIFIED** |
| **DISC-03** | Browser Checkout Failure | "Phase 9 Playwright verified 100% without error" | Screenshot showed `ORDER_NOT_FOUND` for ₹699 checkout attempt | Test script used synthetic string `CTH-ORD-xxx` unpersisted in DB; query lacked `order_number` | Added `OR order_number = $1`, persisted real order in DB before test, captured error-free screenshot | **RESOLVED & VERIFIED** |
| **DISC-04** | Simulation Shortcut | "Genuine Razorpay Standard Checkout" | Client page contained `⚡ Simulate Instant Sandbox Success (Dev / QA Test)` fake button | Shortcut button bypassed gateway and SDK | Permanently removed fake simulation button from `checkout/razorpay/page.tsx` | **RESOLVED & VERIFIED** |
| **DISC-05** | Production Readiness | "Ready for immediate live production release" | Merchant KYC unverified; proprietorship vs private limited entity mismatch; bank settlement unconfirmed | Premature signoff without operational compliance verification | Enforced Release Gate E: Live Mode blocked on API and UI. Status locked to `VERIFIED — TEST MODE ONLY` | **RESOLVED & VERIFIED** |
| **DISC-06** | Dual Operating Hours | "Storefront operating hours ambiguous (11:00 PM vs 11:30 PM)" | Support hours: 10:00 AM – 11:00 PM IST; Kitchen dispatch cutoff: 11:30 PM IST | Two distinct operational workflows treated as contradictory | Clarified dual-window standard in Legal Policies and Documentation | **RESOLVED & VERIFIED** |
| **DISC-07** | Marketing Claims | Storefront showed Monsoon 50% promo and 2-hour Bangalore promises | Outdated Monsoon promo and unverified 2-hour delivery claims persisted in code and CMS | Hardcoded string in `api-engine.ts` and database CMS blocks for `home` | Sanitized `api-engine.ts` and executed DB migration replacing claims with Festive Celebration Offer | **RESOLVED & VERIFIED** |
| **DISC-08** | Cashfree Route Security | "Cashfree code removed" | 21 files contained Cashfree references, some active routes returned 200 mock | Incomplete decommissioning | Configured all active Cashfree routes to return HTTP 410 `CASHFREE_DECOMMISSIONED` while preserving tables | **RESOLVED & VERIFIED** |
