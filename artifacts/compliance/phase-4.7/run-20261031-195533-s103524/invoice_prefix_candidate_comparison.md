# Invoice Prefix Candidate Comparison Matrix
**Evaluation Scope:** FY 2026-27 Invoicing for CakeToHome India Private Limited (`29AABCC1234F1Z5`)  

| Candidate Prefix | Prefix Length | Sequence Width | Full Serial Example | Total Length | Statutory Rule 46(b) | Existing DB Collisions | Annual Sequence Capacity | Recommended Rating |
| :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`CTHI`** | 4 | 5 digits | `CTHI/26-27/00001` | 16 chars | **COMPLIANT** | **0 (Zero)** | 99,999 | **Strongest for Legal Distinction** |
| **`C2H`** | 3 | 6 digits | `C2H/26-27/000001` | 16 chars | **COMPLIANT** | **0 (Zero)** | 999,999 | **Strongest for Volume Runway** |
| **`CTH`** | 3 | 6 digits | `CTH/26-27/000001` | 16 chars | **COMPLIANT** | **55 Collisions** | 999,999 | **Blocked by DB Unique Key** |
| **`INV`** | 3 | 6 digits | `INV/26-27/000001` | 16 chars | **COMPLIANT** | **0 (Zero)** | 999,999 | Generic / Non-Brand |
| **`IN-CTH`** | 6 | 3 digits | `IN-CTH/26-27/001` | 16 chars | **COMPLIANT** | **0 (Zero)** | 999 | Insufficient Capacity |
