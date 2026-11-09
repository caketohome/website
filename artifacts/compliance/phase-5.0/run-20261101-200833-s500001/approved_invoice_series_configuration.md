# Approved Invoice Series Configuration — Phase 5.0
**Status:** DRAFT / PENDING_CORPORATE_EVIDENCE  

---

## 1. Candidate Configurations Staged for Deployment
```json
{
  "recommended_candidate": {
    "prefix": "C2H",
    "financial_year": "26-27",
    "sequence_padding": 6,
    "pattern": "C2H/26-27/000001",
    "capacity": 999999,
    "rule46b_compliant": true
  },
  "fallback_candidate": {
    "prefix": "CTHI",
    "financial_year": "26-27",
    "sequence_padding": 5,
    "pattern": "CTHI/26-27/00001",
    "capacity": 99999,
    "rule46b_compliant": true
  }
}
```
