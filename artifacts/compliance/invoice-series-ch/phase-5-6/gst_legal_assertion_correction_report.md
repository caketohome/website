# GST LEGAL ASSERTION CORRECTION REPORT
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Rectification of Categorical Claims
Previous milestone reports included categorical assertions regarding statutory liabilities arising from the 21 delivered historical orders:
- *Previous Claim:* "Issuing retroactive invoices today would trigger statutory penalties for delayed invoice issuance under CGST Section 122 and interest under Section 50."
- *Defect:* An engineering or technical audit milestone must not make definitive statutory determinations of liability. Legal and tax consequences depend upon specific facts, time-of-supply rules under Section 12, payment receipt timing, and professional legal analysis.

### 2. Mandatory Neutral Statutory Statement
Pursuant to Phase 5.6 Executive Directive (GOV-02), the canonical legal position is established as follows:

> **"Twenty-one delivered historical orders are subject to pending professional GST and accounting review. Their final tax treatment, invoice obligations, payment treatment and any applicable interest or penalty consequences have not been independently determined by this engineering phase."**

### 3. Inventory of the 21 Delivered Historical Orders
| # | Order ID | Display ID | Order Date | Delivery Date | Status | Payment Status | Method | Grand Total (₹) | Professional Review Status | Required Legal Action |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `ord_test_scen_02_bad_gstin` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 2 | `ord_test_scen_03_no_legal_name` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 3 | `ord_test_scen_04_rollback` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 4 | `ord_test_scen_05_committed` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 5 | `ord_test_scen_11_unverified` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 6 | `ord_bad_gstin_test` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1180 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 7 | `ord_persist_1792703206362` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1450.5 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 8 | `ord_test9_1792703331575` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1450.50 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 9 | `ord_case_01_no_gstin` | 78351 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 10 | `ord_case_02_whitespace_gstin` | 16035 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 11 | `ord_case_03_malformed_gstin` | 63268 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 12 | `ord_case_04_no_legal_name` | 75193 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 13 | `ord_case_05_unverified` | 98537 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 14 | `ord_case_06_ambiguous_state` | 10265 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 15 | `ord_case_11_missing_hsn` | 91422 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 16 | `ord_erp_invalid_002` | 66128 | 2026-10 | 2026-10-25 | `delivered` | `paid` | `upi` | ₹1180.00 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 17 | `ord_committed_valid_test` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹1800 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 18 | `order_preservation_1793034788939` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹681.46 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 19 | `order_preservation_1793034932865` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹681.46 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 20 | `order_preservation_1793074567765` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹681.46 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |
| 21 | `order_preservation_1793075666473` | N/A | 2026-10 | Recorded | `delivered` | `paid` | `online` | ₹681.46 | **PENDING_COUNSEL_OPINION** | GST Advocate Review (CGST s.12/31) |


### 4. Remaining 48 Unbilled Orders Disposition
The remaining 48 unbilled orders (consisting of 20 pending and 28 captured orders that have not been delivered) are held in strict quarantine. No automated billing, batch processing, or invoice allocation will occur for these orders without explicit operational review.
