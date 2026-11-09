# CAKETOHOME — COMPLETE FAILURE-INJECTION REPORT (F01–F30)
## Test Execution Results for All 30 Failure Scenarios

| ID | Scenario | Expected Outcome | Observable Test Result | Pass/Fail |
|---|---|---|---|---|
| F01 | OTP provider unavailable | Authentication fails safely | Returns gateway timeout error without creating orphaned session | PASS |
| F02 | Expired access token | Access rejected | JWT validator rejects token with expired timestamp | PASS |
| F03 | Unauthorized role | Operation denied | Customer role denied admin endpoint access | PASS |
| F04 | Cross-branch access | Access denied | Indiranagar manager cannot read Koramangala order | PASS |
| F05 | Cart price manipulation | Tampering rejected | Server resolves catalog price from database | PASS |
| F06 | Stock changes during checkout | Checkout revalidated | Insufficient stock error raised | PASS |
| F07 | Duplicate checkout request | No duplicate order | Idempotency key returns existing order | PASS |
| F08 | Gateway order creation fails | Controlled state | Status moves to payment initiation failed | PASS |
| F09 | Invalid webhook signature | No state update | Forged HMAC rejected with HTTP 400 | PASS |
| F10 | Duplicate webhook | Idempotent handling | Subsequent delivery recognized and skipped | PASS |
| F11 | Concurrent webhook processing | Exactly one transition | FOR UPDATE row lock guarantees single confirmation | PASS |
| F12 | Amount mismatch | Payment exception | Mismatched paise diverts to exception table | PASS |
| F13 | Currency mismatch | Payment exception | Non-INR currency diverts to exception table | PASS |
| F14 | Payment for cancelled order | No order reopening | Payment flagged for refund without reviving order | PASS |
| F15 | Two captured payments | Single settlement | First payment settles order, second flagged as duplicate | PASS |
| F16 | Database failure | Atomic rollback | Transaction failure rolls back all partial rows | PASS |
| F17 | Worker interruption | Recoverable retry | Job remains in queue for subsequent worker pickup | PASS |
| F18 | Inventory update failure | No partial state | Stock deduction error aborts order confirmation | PASS |
| F19 | Duplicate inventory event | Single deduction | Existing SALE movement prevents double deduction | PASS |
| F20 | KOT generation failure | Recoverable state | Order confirmed; KOT marked pending retry | PASS |
| F21 | Duplicate KOT event | Reprint counter increment | KOT number preserved; reprint count incremented | PASS |
| F22 | SMS provider failure | Order unaffected | Order confirmed; SMS marked failed_retry | PASS |
| F23 | WhatsApp provider failure | Order unaffected | Order confirmed; WA marked failed_retry | PASS |
| F24 | Email failure | Order unaffected | Order confirmed; email marked failed_retry | PASS |
| F25 | Delivery assignment failure | Controlled state | Order transitions to assignment_pending | PASS |
| F26 | Unauthorized order update | Access denied | Customer cannot change status to delivered | PASS |
| F27 | Refund webhook repeated | Idempotent handling | Duplicate refund event safely ignored | PASS |
| F28 | Refund after dispatch | Statutory return | Cancellation post-dispatch requires return approval | PASS |
| F29 | Accounting worker retry | No duplicate voucher | Existing reference_id prevents duplicate voucher | PASS |
| F30 | Browser closed after payment | Autonomous completion | Backend webhook completes order without customer browser | PASS |

**Total:** 30 / 30 Passed (0 Failed)
