# BDR-07 Cut-Over Proposal & Dual-Run Protocol — Phase 4.9

---

## 1. Production Cut-Over Sequence
1. Verification of signed Board minutes and authentication of designated corporate signatories.
2. Configuration of approved prefix (`C2H` or `CTHI`) in `compliance_invoice_series` with initial sequence number 1.
3. Execution of single transactional smoke test on checkout API.
4. Activation of real-time invoice generation for all new orders placed after cut-over timestamp $T_0$.
5. Continuous monitoring of sequence continuity.
