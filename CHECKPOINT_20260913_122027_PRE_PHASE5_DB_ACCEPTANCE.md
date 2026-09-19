# CHECKPOINT — PRE-PHASE 5: DATABASE-ONLY ACCEPTANCE TESTS

**Timestamp**: `2026-09-13 12:20:27 IST` (2026-09-13 06:50:27 UTC)  
**Repository Path**: `e:\vig\cakes2home-main\cakes2home-main`  
**Current Branch**: `task/dev`  
**Current Commit**: `308162125fd72ef30c31176ac3312b9e15ff55a2`  
**Previous Checkpoint**: `CHECKPOINT_20260913_122000_PHASE4_CARDS_HEADER_THEME.md`  

---

## 1. Safety Boundaries & Operational Verification

- **Zero Destructive Git Operations**: No `git reset --hard`, no `git clean`, no commits, no pushes.
- **Strict Read-Only Database Mode**: Remote Supabase PostgreSQL 17.6 is queried strictly in read-only mode (`SELECT` only).
- **Protected Business Records**:
  - 3 legacy eggless DB records (`prod_01KYZ4XG8Y5N8KJC6NV54TJTGR`, `prod_01KYZ54K5XD0JP6HJR7R111K5B`, `prod_01KYZ5VK205SFXPVX3MYZTQGHB`) verified untouched.
- **Active Processes**:
  - PID `2276`: Next.js development server on `http://localhost:3000`
- **Database Status**:
  - Host: `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
  - Latency: ~38ms, pool healthy.

---

## 2. Phase 5 Objectives & Test Scope

Execute exhaustive, read-only 6-way integrity checks across all 16 core business domains:
1. **Products**
2. **Categories**
3. **Product Prices / Variants**
4. **Inventory**
5. **Branches**
6. **Customers**
7. **Orders**
8. **Order Items**
9. **Taxes / GST**
10. **Offers / Coupons**
11. **CMS Pages**
12. **CMS Sections**
13. **Published Versions**
14. **Delivery Slots**
15. **Delivery Zones**
16. **Customer Segments / Reports**

For every domain, verify the strict contract:
`UI Value == API Response == Service / Repository Query == PostgreSQL Row`  
And verify consistency after browser reload and process boundaries.
Any discrepancy will be flagged as `BLOCKED — SOURCE OF TRUTH VIOLATION`.
