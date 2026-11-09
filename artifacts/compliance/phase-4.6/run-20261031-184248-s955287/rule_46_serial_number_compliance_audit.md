# Rule 46 Serial Number Compliance Audit
**Standard:** CGST Rules 2017, Rule 46(b)  
**Statutory Constraint:** Maximum 16 characters, unique per financial year, permitted charset `[A-Za-z0-9/-]`.  

---

## 1. Complete Invoice Number Structure Analysis
CakeToHome constructs tax invoice serial numbers using the format:
```
[PREFIX] / [FINANCIAL_YEAR] / [CONSECUTIVE_SEQUENCE]
```

### Length Arithmetic Breakdown:
- **Separators:** Two slash characters (`/` and `/`) = 2 characters.
- **Financial Year:** Two-digit short format (`YY-YY`, e.g. `26-27`) = 5 characters.
- **Formatting Subtotal:** 2 + 5 = 7 characters.
- **Remaining Capacity:** 16 - 7 = **9 characters** allocated between Prefix and Sequence.

### Permitted Prefix & Sequence Combinations:

| Prefix Characters | Prefix Example | Sequence Digits | Sequence Capacity | Full Invoice Number Example | Total Length | Compliance Status |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: |
| **3** | `CTH` | 6 | 999,999 | `CTH/26-27/000001` | **16** | **COMPLIANT** |
| **2** | `CT` | 7 | 9,999,999 | `CT/26-27/0000001` | **16** | **COMPLIANT** |
| **4** | `CTHI` | 5 | 99,999 | `CTHI/26-27/00001` | **16** | **COMPLIANT** |
| **4** | `CTHI` | 6 | 999,999 | `CTHI/26-27/000001` | **17** | **NON-COMPLIANT** |
| **4** | `CONC` (historical) | 6 | 999,999 | `CONC/26-27/000001` | **17** | **NON-COMPLIANT** |
| **9** | `SAFE-TEST` (hist.)| 6 | 999,999 | `SAFE-TEST/26-27/000001` | **22** | **NON-COMPLIANT** |

> [!CRITICAL]
> If a 6-digit sequence is used, the prefix **must not exceed 3 characters**.
> All historical prefixes exceeding 3 characters (`CONC`, `SAFE-TEST`, `PRT-8899`) have been neutralized to `REVOKED_SYNTHETIC` in migration `c7_13`.
