# CAKETOHOME — RLS AND SECURITY AUDIT
## Row Level Security, Branch Scoping & Secret Protection

### 1. Access Control Boundaries
- **Tenant Isolation:** Branch managers restricted to their operational branch. Cross-branch reads/writes blocked.
- **Customer Privacy:** Customers can only read and query their own order and profile records.
- **Financial Protection:** Accounting tables (`accounting_voucher`, `accounting_journal_line`) restricted to `FINANCE` and `SUPER_ADMIN` roles.

### 2. Secret Protection
- No hardcoded secrets in source files.
- Secrets retrieved exclusively via environment variables (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `JWT_SECRET`).
