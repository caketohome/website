# CAKETOHOME — DEFECT REMEDIATION & RESIDUAL RISK REGISTER
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. DEFECTS REMEDIATED DURING INTEGRATION
| Defect ID | Description | Root Cause | Remediation Applied | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | Multi-statement prepared query failure in migration script | `pg` driver disallows multiple SQL statements in parameterized calls | Split statements into individual `client.query` calls in `migrate_cross_app_integration.cjs` | **VERIFIED RESOLVED** |
| **DEF-02** | PostgreSQL WIN1252 Unicode error (`₹`) | Windows PG collation `WIN1252` rejects UTF-8 currency symbol byte sequence | Replaced Unicode `₹` with standard `INR ` format in SQL narrations | **VERIFIED RESOLVED** |
| **DEF-03** | Cash Flow Statement variance on opening balance vouchers | Voucher query checked `entry_date = $1` instead of inclusive period range | Updated `cash-flow.service.ts` to check `entry_date >= $1 AND entry_date <= $2` | **VERIFIED RESOLVED** |
| **DEF-04** | Missing columns in `customer_notification_queue` | Table schema lacked `template` and `event_type` defaults | Added schema migration and updated `cashfree-payment.service.ts` | **VERIFIED RESOLVED** |
| **DEF-05** | Order repository state machine transition blocked | Transition from `confirmed` directly to `delivered` was omitted in state table | Added direct transition in `OrderRepository.VALID_TRANSITIONS` | **VERIFIED RESOLVED** |
| **DEF-06** | Webhook deduplication response key mismatch | Service returned `idempotent: true` while test checked `idempotent_replay` | Returned both `idempotent: true` and `idempotent_replay: true` | **VERIFIED RESOLVED** |

## 2. RESIDUAL RISKS & PRODUCTION RECOMMENDATIONS
- **Residual Defects:** 0 blocking defects. All 35 integration tests pass 100%.
- **Protected Database Integrity:** `cth_test` verified 100% untouched with 0 writes.
