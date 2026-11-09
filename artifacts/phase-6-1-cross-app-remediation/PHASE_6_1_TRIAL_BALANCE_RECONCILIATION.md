# PHASE 6.1 — TRIAL BALANCE RECONCILIATION

### Exhaustive 17-Account Trial Balance (Source of Truth: PostgreSQL `cth_rehearsal_phase5`)

| Account Code | Account Name | Type | Total Debit (₹) | Total Credit (₹) | Net Balance (₹) |
|:---|:---|:---|---:|---:|---:|
| `1112` | Bank Operating A/c | ASSET | 289056.00 | 150000.00 | 139056.00 |
| `1112-01` | State Bank of India - SBI Operating 3344 | ASSET | 100000.00 | 0.00 | 100000.00 |
| `1112-02` | Axis Bank - Axis Corporate Treasury 60545 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1112-03` | Axis Bank - Axis Corporate Treasury 37811 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1112-04` | Axis Bank - Axis Corporate Treasury 77091 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1112-05` | Axis Bank - Axis Corporate Treasury 01077 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1112-06` | Axis Bank - Axis Corporate Treasury 77887 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1112-07` | Axis Bank - Axis Corporate Treasury 06204 | ASSET | 150000.00 | 0.00 | 150000.00 |
| `1113` | Gateway Clearing | ASSET | 221.76 | 50000.00 | -49778.24 |
| `1114` | Petty Cash - Branches | ASSET | 5000.00 | 0.00 | 5000.00 |
| `1115` | Bank Settlement In Transit | ASSET | 48820.00 | 39056.00 | 9764.00 |
| `2121` | Output CGST 2.5% (Food/Bakery) | LIABILITY | 0.00 | 17.82 | -17.82 |
| `2122` | Output SGST 2.5% (Food/Bakery) | LIABILITY | 0.00 | 17.82 | -17.82 |
| `2141` | Customer Advances | LIABILITY | 332.64 | 221.76 | 110.88 |
| `3300` | Opening Balance Offset / Capital Reserve | EQUITY | 0.00 | 1105000.00 | -1105000.00 |
| `4110` | Cake & Bakery Sales Revenue (5% GST) | REVENUE | 0.00 | 297.00 | -297.00 |
| `5290` | Payment Gateway MDR Fees | EXPENSE | 1180.00 | 0.00 | 1180.00 |
| **TOTALS** | **ALL 17 ACCOUNTS** | **BALANCED** | **₹1344610.40** | **₹1344610.40** | **₹0.00** |

### Mathematical Audit Verification
- **Total Debit Sum:** ₹1344610.40
- **Total Credit Sum:** ₹1344610.40
- **Variance:** ₹0.00 (**ZERO VARIANCE — PERFECT EQUALITY**)
