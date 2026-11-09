# Eleven-Point Corporate Decision Register — Phase 4.9

| Decision ID | Description | Current State | Responsible Entity | Technical Verification |
|---|---|---|---|---|
| **BDR-01** | Legal Entity Name & CIN Adoption (`CakeToHome India Private Limited`, `U15400KA2026PTC189211`) | `NOT_SUBMITTED` / `PENDING_EVIDENCE` | Board of Directors | Database schema supports legal entity fields. |
| **BDR-02** | GSTIN Ratification (`29AABCC1234F1Z5` for Karnataka) | `NOT_SUBMITTED` / `PENDING_EVIDENCE` | Board of Directors | Format validated against 15-digit GSTIN regex. |
| **BDR-03** | Statutory Invoice Numbering Structure Designation | `NOT_SUBMITTED` / `PENDING_EVIDENCE` | Board of Directors | Alternative A candidates ready (`C2H` or `CTHI`). |
| **BDR-04** | Delegation of Approval Authority (Dual Control) | `NOT_SUBMITTED` / `PENDING_EVIDENCE` | Board of Directors | Database trigger enforces Submitter != Approver. |
| **BDR-05** | Controlled Activation Gate Protocol Authorization | `NOT_SUBMITTED` / `PENDING_EVIDENCE` | Board of Directors | Fail-closed software gate implemented. |
| **BDR-06** | Sequential Monotonicity & Gap Detection | `IMPLEMENTED` | Engineering Team | Atomic `SELECT ... FOR UPDATE` lock verified. |
| **BDR-07** | Cut-Over Protocol & Dual-Run Invoicing | `IMPLEMENTED` | Engineering Team | Idempotent transition verified in rehearsal. |
| **BDR-08** | Warning Threshold Assessment (Capacity Limits) | `IMPLEMENTED` | Engineering Team | Thresholds configured (80% warning, 95% critical). |
| **BDR-09** | Zero Retroactive Billing of Historical Orders | `IMPLEMENTED` | Engineering Team | All 69 unbilled orders strictly quarantined. |
| **BDR-10** | GSTR-1 Table 13 Document Summary SOP | `DOCUMENTED` | Finance Operations | Serial ledger reconciliation protocol ready. |
| **BDR-11** | April 1 IST Financial Year Rollover Procedure | `DOCUMENTED` | DevOps & Finance | Automated midnight rollover protocol defined. |
