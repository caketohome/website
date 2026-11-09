# PHASE 5.5 DECISION REGISTER (CH-01 TO CH-20)
**Project:** CakeToHome India Private Limited  

| ID | Decision | Scope | Status |
| :--- | :--- | :--- | :---: |
| **CH-01** | Selected proposed prefix is CH | Prefix Selection | Business decision |
| **CH-02** | Format is CH/FY/SERIAL | Invoice Structure | Proposed specification |
| **CH-03** | Minimum six-digit serial | Padding Width | Selected design |
| **CH-04** | Seven-digit expansion permitted within limit | Expansion Ceiling | Proposed design |
| **CH-05** | No serial truncation or wrapping | Formatter Rule | Mandatory technical rule |
| **CH-06** | One sequence per company, GSTIN and FY | Scoping Rule | Selected business architecture |
| **CH-07** | Shared sequence across branches under same GSTIN | Channel Scope | Selected architecture |
| **CH-08** | Separate sequence per GSTIN | Multi-Registration | Selected architecture |
| **CH-09** | Transactional database allocation | Allocation Engine | Mandatory technical design |
| **CH-10** | Database-enforced uniqueness | Integrity Rule | Mandatory technical design |
| **CH-11** | No reuse of issued or cancelled numbers | Anti-Reuse Policy | Mandatory control |
| **CH-12** | 80% capacity warning | Monitoring Alert | Selected operational policy |
| **CH-13** | 95% capacity critical alert | Monitoring Escalation | Selected operational policy |
| **CH-14** | Capacity overflow blocks issuance | Capacity Hard Ceiling | Mandatory control |
| **CH-15** | Historical invoices remain unchanged | Historical Protection | Mandatory protection |
| **CH-16** | Historical 69 orders remain held pending disposition | Order Quarantine | Mandatory protection |
| **CH-17** | Production remains disabled in Phase 5.5 | Release Restriction | Explicit restriction |
| **CH-18** | Six-layer authorization remains independent | Governance Gate | Mandatory governance control |
| **CH-19** | Layer 5 requires attributable independent human approval | Human Sign-off | Mandatory governance control |
| **CH-20** | Layer 6 requires controlled human execution | Operational Release | Mandatory governance control |