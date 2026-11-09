# Segregation of Duties (SoD) Verification — Phase 5.0

---

## 1. Dual Control Boundaries
1. Submitter cannot approve their own series proposal.
2. Series configurator cannot approve series proposals.
3. Developers cannot grant corporate authority or issue invoices directly.
4. Client-supplied headers (`x-user-role: admin`) are discarded by server middleware.
5. All corporate state transitions generate append-only audit log records.
