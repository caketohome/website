# PHASE 5.6 DECISION REGISTER (CH-01 TO CH-20 & GOV-01 TO GOV-10)
**Milestone:** Phase 5.6 — Independent Architecture Verification, Governance Model Restoration, Legal Evidence Accuracy & Final Release-Gate Integrity Audit  
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5` (Karnataka State Code 29)  
**Date:** 2026-11-02  
**Arena Run ID:** [`run-20261102-195500-s560001`](file:///e:/vig/.arena/run-20261102-195500-s560001) | **Seed:** `560001` | **Champion:** `a003` (`Evidence first + Requirements checklist + Built to last`)  
**Skill-Router Execution ID:** `sr-20261102-195500-p56`  
**Protected Database:** `cth_test` (100% read-only; 0 writes verified)  
**Disposable Rehearsal DB:** `cth_rehearsal_phase5_6` (19/19 tests passed 100%)  


### 1. Canonical Series Decisions (CH-01 to CH-20)
| ID | Decision Summary | Status |
| :--- | :--- | :---: |
| **CH-01** | Proposed prefix is `CH` | Business Baseline |
| **CH-02** | Format is `CH/26-27/000001` | Proposed Specification |
| **CH-03** | Minimum six-digit serial | Approved Specification |
| **CH-04** | Seven-digit expansion permitted | Approved Specification |
| **CH-05** | Truncation and wrapping prohibited | Technical Invariant |
| **CH-06** | One sequence per company, GSTIN, and FY | Technical Invariant |
| **CH-07** | Shared sequence across Karnataka branches/channels | Architectural Baseline |
| **CH-08** | Separate sequence per GSTIN registration | Technical Invariant |
| **CH-09** | Transactional database allocation | Technical Invariant |
| **CH-10** | Database-enforced uniqueness | Technical Invariant |
| **CH-11** | Anti-reuse of issued or cancelled numbers | Statutory Invariant |
| **CH-12** | 80% capacity warning (serial 7,999,999) | Operational Policy |
| **CH-13** | 95% capacity critical alert (serial 9,499,999) | Operational Policy |
| **CH-14** | Capacity hard block (serial 10,000,000) | Technical Invariant |
| **CH-15** | Historical invoices remain unchanged | Historical Invariant |
| **CH-16** | 69 unbilled orders held in quarantine | Operational Invariant |
| **CH-17** | Production remains disabled in Phase 5.6 | Release Gate Control |
| **CH-18** | Six-layer authorization model enforced | Governance Control |
| **CH-19** | Layer 5 requires attributable human approval | Governance Control |
| **CH-20** | Layer 6 requires controlled human execution | Governance Control |

### 2. Governance Correction Decisions (GOV-01 to GOV-10)
| ID | Decision Description | Corrected State | Verification Evidence |
| :--- | :--- | :--- | :---: |
| **GOV-01** | Restore Canonical Six-Layer Model | L1: Evidence Verification, L2: Corporate Approval, L3: Professional Clearance, L4: Technical Readiness, L5: Independent Auth, L6: Controlled Execution | Verified across all manifests and reports |
| **GOV-02** | Rectify Legal Assertion Wording | Replaced speculative penalty claims with neutral statement on 21 delivered orders | Applied to all deliverables |
| **GOV-03** | Evidence Provenance Standard | Strict provenance, SHA-256 hash, and reviewer identity required | Validated in evidence registers |
| **GOV-04** | Locking Architecture Audit | Row-level lock on `invoice_sequence` is canonical; advisory lock verified as cold-start guard | Verified via concurrency benchmark |
| **GOV-05** | Historical Uniqueness Proof | Verified uniqueness across legal entity, GSTIN, series, and FY | 19/19 rehearsal tests |
| **GOV-06** | Artifact Mirror-Path Resolution | Distinct paths documented: primary repository vs root compliance mirror | Verified filesystem existence |
| **GOV-07** | Cryptographic Manifest Rigor | SHA-256 hash validates file integrity, not legal truth | Certified in manifest |
| **GOV-08** | Test Evidence Re-execution | Full 19-test suite executed in fresh disposable database | `cth_rehearsal_phase5_6` passed 100% |
| **GOV-09** | Layer 5 Human Sign-off Control | Strictly human, attributable, fail-closed gate; auto-grant prohibited | Certified in release gate |
| **GOV-10** | Layer 6 Production Prohibition | Production invoicing disabled; live deployment blocked | Verified fail-closed state |
