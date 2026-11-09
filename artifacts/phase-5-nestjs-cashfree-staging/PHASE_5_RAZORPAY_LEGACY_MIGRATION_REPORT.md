# CAKETOHOME — RAZORPAY LEGACY MIGRATION REPORT
## Decommissioning of Active Paths & Historical Data Preservation

### 1. Active Decommissioning
- Storefront checkout form: Razorpay radio option replaced with Cashfree.
- Checkout server action: Submitting `payment_method: 'razorpay'` explicitly rejected.
- Legacy webhook route (`/api/v1/payments/webhook`): Responds with `410 Gone` and instructions to use Cashfree.
- NestJS payments & webhooks controllers: Return `410 Gone` for Razorpay operations.

### 2. Historical Preservation
- Verified 18 historical Razorpay transactions in `payment_transaction` table remained untouched (**CF-14 PASS**).
- Zero historical rows modified or deleted.
