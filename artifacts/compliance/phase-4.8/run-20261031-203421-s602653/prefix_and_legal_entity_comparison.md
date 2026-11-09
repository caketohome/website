# Prefix and Legal Entity Comparison

## 1. Statutory Rule 46(b) Requirements
Section 31 of the CGST Act read with Rule 46(b) mandates that tax invoice serial numbers:
1. Contain consecutive serial numbers.
2. Not exceed 16 characters.
3. Be unique for each financial year.
4. Contain only alphabets, numerals, and special characters hyphen (`-`) and slash (`/`).

## 2. Prefix Candidate Evaluation

| Candidate | Pattern | Length | Annual Capacity | DB Collisions in `cth_test` | Rule 46(b) Status | Recommendation |
|---|---|---|---|---|---|---|
| **CTHI** | `CTHI/26-27/00001` | 16 chars | 99,999 invoices | **0 collisions** | Fully Compliant | Suitable for standard enterprise volume. |
| **C2H** | `C2H/26-27/000001` | 16 chars | 999,999 invoices | **0 collisions** | Fully Compliant | High-volume option. |
| **CTH (Legacy)** | `CTH/26-27/000001` | 16 chars | 999,999 invoices | **55 collisions** (SQLSTATE 23505) | Non-compliant for new series | Reusing CTH triggers table-wide unique key collision. |

## 3. Strict Engineering Neutrality
The engineering team maintains strict neutrality between `CTHI` and `C2H`. Both candidates are technically viable and 100% compliant with Rule 46(b). Selection is purely a business and governance prerogative.
