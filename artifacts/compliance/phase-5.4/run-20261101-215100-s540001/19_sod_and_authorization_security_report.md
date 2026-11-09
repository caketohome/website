# Phase 5.4 — Segregation of Duties (SoD) and Authorization Security Report
**Security Invariants:**
1. **Requester / Approver Separation:** Software and release engineers cannot approve production activation.
2. **Database Constraint:** `CHECK (requester_id != approver_id)` enforced on authorization records.
3. **Role-Based Access Control:** Separate roles for Secretariat, Tax Counsel, Engineering, and Board Officers.
4. **Adversarial Test Verification:** Self-approval attempts and role impersonation attempts were executed in rehearsal and successfully rejected.