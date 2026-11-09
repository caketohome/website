# Prefix Finalization Comparison — Phase 4.9
**Objective:** Compare candidate options under CBIC CGST Rule 46(b) and database constraints.

---

## 1. Candidate Comparison Table

| Attribute | Candidate 1: `CTHI` | Candidate 2: `C2H` | Candidate 3: `CTH` (Historical) |
|---|---|---|---|
| **Full Format** | `CTHI/26-27/00001` | `C2H/26-27/000001` | `CTH/26-27/000001` |
| **Character Breakdown** | 4 prefix + 1 / + 5 FY + 1 / + 5 seq | 3 prefix + 1 / + 5 FY + 1 / + 6 seq | 3 prefix + 1 / + 5 FY + 1 / + 6 seq |
| **Total Length** | 16 characters | 16 characters | 16 characters |
| **Rule 46(b) Limit ($le 16$)** | COMPLIANT (16/16) | COMPLIANT (16/16) | COMPLIANT (16/16) |
| **Annual Sequence Capacity** | 99,999 invoices | 999,999 invoices | 999,999 invoices |
| **Collision with `inv_1792901376459_xlxkf`** | **ZERO (0)** | **ZERO (0)** | **FATAL COLLISION (SQLSTATE 23505)** |
| **Relational Schema Risk** | Zero | Zero | Fatal |
| **Commercial Brand Fit** | CakeToHome India | Cakes2Home Web Brand | CakeToHome Acronym |
| **Status** | **APPROVED CANDIDATE** | **APPROVED CANDIDATE (RECOMMENDED)** | **DISQUALIFIED** |
