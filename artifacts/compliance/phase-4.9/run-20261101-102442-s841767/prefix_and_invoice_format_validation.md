# Prefix and Invoice Format Validation (Rule 46b Compliance)

## 1. Statutory Rule 46(b) Criteria
- Maximum length: 16 characters.
- Characters permitted: `[A-Z0-9/-]`.
- Serial numbering: Consecutive, unique for each financial year.

## 2. Prefix Candidate Comparison

| Candidate | Format String | Length | Annual Capacity | Collisions in `cth_test` | Compliance |
|---|---|---|---|---|---|
| **`CTHI`** | `CTHI/26-27/00001` | 16 chars | 99,999 | **0 collisions** | **COMPLIANT** |
| **`C2H`** | `C2H/26-27/000001` | 16 chars | 999,999 | **0 collisions** | **COMPLIANT** |
| **`CTH` (Legacy)** | `CTH/26-27/000001` | 16 chars | 999,999 | **55 collisions** (SQLSTATE `23505`) | **COLLISION BLOCKED** |

Reusing `CTH` causes 55 duplicate key collisions against `public.invoice` due to the table-wide unique constraint `invoice_invoice_number_key`.
The engineering team maintains strict neutrality between `CTHI` and `C2H`.
