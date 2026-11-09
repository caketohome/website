# CakeToHome Phase 4.3 — Synthetic Approval Provenance Audit

## 1. Scope & Objective
Forensic tracking and classification of all synthetic approver identities and test prefixes across CakeToHome databases and codebases.

## 2. Inventory of Investigated Prefixes

| Prefix | GSTIN | FY | Original Source | Post-c7_12 State | Post-c7_13 State | Forensic Classification | Justification |
|---|---|---|---|---|---|---|---|
| `SAFE-TEST` | `29AABCC1234F1Z5` | 2026 | Phase 3.9 Safeguard Matrix Test | `APPROVED` (`ca_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Created as a test harness string; never authorized by a human CA. |
| `CONC` | `29AABCC1234F1Z5` | 2026 | Phase 3.9 PG Concurrency Test | `APPROVED` (`ca_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Concurrency benchmark fixture for high-contention lock testing. |
| `FYBND` | `29AABCC1234F1Z5` | 2025 | Phase 3.9 Fiscal Boundary Test | `APPROVED` (`ca_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Boundary edge-case test string for FY rollover verification. |
| `FYBND` | `29AABCC1234F1Z5` | 2026 | Phase 3.9 Fiscal Boundary Test | `APPROVED` (`ca_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Boundary edge-case test string for FY rollover verification. |
| `LKTEST` | `29AABCC1234F1Z5` | 2026 | Phase 3.9 Advisory Lock Test | `APPROVED` (`ca_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Advisory lock contention test string. |
| `PRT-8899` | `27AABCP1234K1Z2` | 2026 | Phase 3.9 Partner Branch Test | `APPROVED` (`partner_audit_signed`) | `REVOKED_SYNTHETIC` | **Synthetic Test Fixture** | Partner test fixture; no third-party audit agreement on record. |
| `CTH` | `29AAACC1234F1Z5` | 2026 | Historical Production Baseline | `DEPRECATED_HISTORICAL` | `DEPRECATED_HISTORICAL` | **Genuine Historical Configuration** | Bound to old company GSTIN. Sealed against re-allocation under CGST Rule 46. |

## 3. Investigated Approver Identities
1. `ca_audit_signed`: Synthetic literal injected in `c7_12` line 42. Blocked at database trigger layer.
2. `partner_audit_signed`: Synthetic literal injected in `c7_12` line 49. Blocked at database trigger layer.
3. `system_audit`: Migration baseline literal in `c7_12` line 35. Blocked from granting `APPROVED` status.

## 4. Reclassification & Preservation Outcome
No rows were deleted. Historical `last_seq` counters were preserved intact (`SAFE-TEST`=3, `CONC`=152, `LKTEST`=2, `PRT-8899`=1, `FYBND`=1). Idempotent replay for previously allocated test orders continues to return historical invoice numbers without re-incrementing sequences or throwing unhandled errors.

