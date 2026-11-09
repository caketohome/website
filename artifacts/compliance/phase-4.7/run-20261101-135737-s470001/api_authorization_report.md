# API Authorization Report
**Routes Audited:**
- `/api/v1/compliance/invoice-series`
- `/api/v1/compliance/corporate-decisions`
- `/api/v1/compliance/evidence`
- `/api/v1/compliance/release-gate`

## Security Verifications
- Server-side session authentication enforced on all compliance endpoints.
- Client-supplied `x-role` or `x-user` headers stripped and ignored.
- Dual-control verification required for all status transition APIs.
