# Segregation of Duties Test Report
**Test Engine:** `run_unified_phase4_7_verification.cjs`  
**Target:** `cth_rehearsal_phase4_7`  

## Verified Test Cases
1. **P47-SOD-01 (Submitter Self-Approval):** Submitter attempting to approve own evidence -> REJECTED (HTTP 403 / `SOD_VIOLATION_SELF_APPROVAL`). **[PASS]**
2. **P47-SOD-02 (Dual-Control Approval):** Distinct authorized officer approving evidence -> ACCEPTED. **[PASS]**
3. **P47-SOD-03 (Configurator Self-Approval):** Series creator attempting to approve series configuration -> REJECTED. **[PASS]**
4. **P47-SOD-04 (Developer Bypass):** Developer role attempting production activation -> REJECTED (`INSUFFICIENT_CORPORATE_AUTHORITY`). **[PASS]**
5. **P47-SOD-05 (SysAdmin Bypass):** SysAdmin role without Director resolution attempting activation -> REJECTED. **[PASS]**
