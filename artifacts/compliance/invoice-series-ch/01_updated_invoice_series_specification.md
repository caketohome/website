# INVOICE-SERIES SPECIFICATION: SERIES 'CH'
**Project:** CakeToHome / CakeToHome India Private Limited  
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5`  
**Document Status:** PROPOSED SERIES — PENDING FORMAL BOARD ADOPTION & PROFESSIONAL CLEARANCE  
**Date:** 2026-11-02  

---

## 1. Selected Invoice Prefix
The selected business preference is **`CH`**, formally replacing the previously evaluated `CTH`, `C2H`, and `CTHI` alternatives.

Proposed format:
`CH/26-27/000001`

This is an approved business proposal, not yet a formally adopted or production-authorized series. Live sequence initialization and invoice issuance remain disabled pending Layer 5 human authorization.

---

## 2. Serial-Number Length & Dynamic Expansion Specification

### 2.1 Component Structure
| Segment | Component | Characters | Content / Format | Example |
| :---: | :--- | :---: | :--- | :--- |
| 1 | Entity Prefix | 2 | Selected Business Identifier | `CH` |
| 2 | Separator | 1 | Slash | `/` |
| 3 | Financial Year | 5 | YY-YY (April to March) | `26-27` |
| 4 | Separator | 1 | Slash | `/` |
| 5 | Serial Counter | 6 or 7 | Consecutive Digits | `000001` to `9999999` |

### 2.2 Serial Width Invariants
- **Minimum Serial Width:** 6 digits (zero-padded: `000001` to `999999`). Complete invoice length: **15 characters**.
- **Expansion Serial Width:** Expands seamlessly to 7 digits (`1000000` to `9999999`). Complete invoice length: **16 characters** (exact statutory ceiling).
- **Maximum Complete Serial-Number Length:** Strictly **16 characters**, in full compliance with Rule 46(b) of the Central Goods and Services Tax Rules, 2017.
- **Literal Unlimited Length Prohibited:** Serials $\ge 10,000,000$ (8 digits, resulting in 17 characters) are strictly rejected with `STATUTORY_CAPACITY_EXCEEDED`.
- **Leading Zeros Preservation:** Leading zeros are strictly preserved for six-digit serials.
- **No Truncation or Wrap:** The sequence never wraps, truncates, or resets unexpectedly across the 999,999 to 1,000,000 boundary.

---

## 3. Capacity Runway & Warning Thresholds
- **Annual Serial Capacity:** **9,999,999 invoices** per financial year per GSTIN.
- **Runway Analysis:** At projected baseline velocity of 1,500 orders/day (~547,500/year), runway exceeds 18 years of operations within a single financial year.
- **Warning Alert Threshold (80%):** System triggers automated high-priority alert at sequence **7,999,999**.
- **Critical Alert Threshold (95%):** System triggers executive escalation at sequence **9,499,999**.
- **Statutory Capacity Guard (100%):** Allocation attempts beyond **9,999,999** are blocked.