# HISTORICAL 21 DELIVERED ORDER DISPOSITION REPORT
**Milestone:** Phase 5.7 Onward: Finalization, Corporate & Professional Clearance, Production Readiness, Controlled Release and Project Closure  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-204500-s570001`](file:///e:/vig/.arena/run-20261102-204500-s570001) | **Seed:** `570001` | **Champion:** `a001` (`First principles + Build, then break + Edge cases first`)  
**Skill-Router Execution ID:** `sr-20261102-204500-p57`  
**Actual PostgreSQL Version:** `PostgreSQL 16.14, compiled by Visual C++ build 1944, 64-bit` (verifying ground truth against historical 17.11 report)  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_7` (19/19 tests passed 100%)  


### 1. Order-Level Review Table
| # | Order ID | Display ID | Order Date | Delivery Date | Payment Status | Method | Grand Total (₹) | Review Status | Mandatory Action |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `ord_test_scen_02_bad_gstin` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 2 | `ord_test_scen_03_no_legal_name` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 3 | `ord_test_scen_04_rollback` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 4 | `ord_test_scen_05_committed` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 5 | `ord_test_scen_11_unverified` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 6 | `ord_bad_gstin_test` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1180 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 7 | `ord_persist_1792703206362` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1450.5 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 8 | `ord_test9_1792703331575` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1450.50 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 9 | `ord_case_01_no_gstin` | 78351 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 10 | `ord_case_02_whitespace_gstin` | 16035 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 11 | `ord_case_03_malformed_gstin` | 63268 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 12 | `ord_case_04_no_legal_name` | 75193 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 13 | `ord_case_05_unverified` | 98537 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 14 | `ord_case_06_ambiguous_state` | 10265 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 15 | `ord_case_11_missing_hsn` | 91422 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 16 | `ord_erp_invalid_002` | 66128 | 2026-10 | 2026-10-25 | `paid` | `upi` | ₹1180.00 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 17 | `ord_committed_valid_test` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹1800 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 18 | `order_preservation_1793034788939` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹681.46 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 19 | `order_preservation_1793034932865` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹681.46 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 20 | `order_preservation_1793074567765` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹681.46 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |
| 21 | `order_preservation_1793075666473` | N/A | 2026-10 | Recorded | `paid` | `online` | ₹681.46 | **LEGAL_HOLD** | GST Counsel Written Opinion Required |


### 2. Legal Hold Protocol
All 21 delivered orders represent historical deliveries where contemporary tax invoices were not generated at the time of supply. Pursuant to Phase 5.7 directives, these orders remain on **LEGAL HOLD**. No retroactive invoices will be generated until formal written advice from the company's GST Counsel is obtained.
