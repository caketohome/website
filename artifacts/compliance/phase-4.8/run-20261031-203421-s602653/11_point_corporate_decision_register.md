# 11-Point Corporate Decision Register
**Document Reference:** Board Submission `CTH-GOV-2026-SUB-01`  
**Current Governance Status:** PROPOSED FOR BOARD CONSIDERATION (PENDING ADOPTION)  

---

| Item # | Governance Question / Decision Subject | Evidence & Technical Finding | Current Status | Recommended Board Action |
|---|---|---|---|---|
| **1** | **Entity Scope & Separation** | CakeToHome India Pvt Ltd (`29AABCC1234F1Z5`) vs CakeToHome Retail India Pvt Ltd (`29AAACC1234F1Z5`). | Documented | Confirm operational entity boundaries and independent registrations. |
| **2** | **Production Prefix Designation** | Candidate `CTHI` (99k cap) vs `C2H` (999k cap). Reusing `CTH` causes 55 collisions. | Evaluated | Adopt specific prefix by resolution. |
| **3** | **Rule 46(b) Formatting** | Must be consecutive, unique, <= 16 chars, containing only `[A-Z0-9/-]`. | Validated | Adopt formatting standard (`PREFIX/YY-YY/SEQUENCE`). |
| **4** | **Historical Invoicing Cutoff** | 55 historical CTH invoices and 15 synthetic invoices exist in database. | Reconciled | Declare historical cutoff date and freeze legacy series. |
| **5** | **Delegation of Approval Authority** | Proposes dual approval by Director + CA/Auditor. | Defined | Designate named approver identities in corporate resolution. |
| **6** | **Segregation of Duties (SOD)** | Approver cannot be the same entity proposing the series. | Trigger Enforced | Confirm corporate policy requiring independent audit sign-off. |
| **7** | **Delivered Unbilled Orders (21)** | 18 scenario tests (void) + 3 historical orders (need CA review). | Classified | Authorize formal write-off / CA treatment of the 3 historical orders. |
| **8** | **Draft Vouchers (4)** | 4 unposted draft vouchers (1 cancelled). Zero GL distortion. | Reconciled | Direct accounting closure / cancellation of historical draft vouchers. |
| **9** | **Synthetic Test Data Isolation** | 15 synthetic invoices isolated from customer views and tax returns. | Verified | Authorize permanent archival flag on synthetic rows. |
| **10** | **Fail-Closed Activation Gate** | System rejects billing unless series is in `APPROVED` status. | Tested | Confirm policy that invoicing cannot proceed without signed authorization. |
| **11** | **Deployment Execution Mandate** | Technical release candidate verified; deployment awaits Board authorization. | Ready | Authorize release execution following formal Board resolution adoption. |
