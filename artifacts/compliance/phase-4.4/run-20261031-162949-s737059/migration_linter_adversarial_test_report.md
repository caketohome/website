# Migration Linter Adversarial Test Report

## 1. Adversarial Test Corpus & Results
A 15-case adversarial corpus was constructed to challenge the migration linter:

| ID | Evasion Category | Original Linter | Hardened Linter | Outcome |
| :--- | :--- | :---: | :---: | :---: |
| ADV-LINT-01 | Multiline SET Splitting | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-02 | Multiline Value Splitting | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-03 | Inline Comment Splitting | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-04 | Mixed Case Keywords | PASS | **PASS** | Maintained |
| ADV-LINT-05 | Direct INSERT Promotion | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-06 | Synthetic Token in INSERT | PASS | **PASS** | Maintained |
| ADV-LINT-07 | String Concatenation | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-08 | Dynamic SQL (DO $$ EXECUTE) | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-09 | Dynamic SQL (format()) | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-10 | Block Comment False Positive | FAIL (False Alarm) | **PASS (Ignored)** | Remediated |
| ADV-LINT-11 | Alternate Directory File | PASS | **PASS** | Maintained |
| ADV-LINT-12 | Quoted Identifiers | FAIL (Bypassed) | **PASS (Detected)** | Remediated |
| ADV-LINT-13 | UPSERT ON CONFLICT | PASS | **PASS** | Maintained |
| ADV-LINT-14 | String Literal False Positive | FAIL (False Alarm) | **PASS (Ignored)** | Remediated |
| ADV-LINT-15 | Clean Migration Control | PASS | **PASS** | Maintained |

**Pass Rate**: Original = 33.3% (5/15) -> Hardened = **100% (15/15)**.