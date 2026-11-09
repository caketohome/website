# CAKETOHOME — DATABASE MIGRATION REGISTER
## Schema Evolution & Table Structure Verification

### 1. Modified & Verified Tables
1. `payment_transaction`: Added support for `provider = 'cashfree'`, `gateway_order_id`, `gateway_payment_id`, `gateway_signature`.
2. `payment_webhook_event`: Stores incoming Cashfree events, `signature_valid = true`, and payload for strict replay defense.
3. `inventory_movement`: Deducts stock with `direction = 'OUT'` and `movement_type = 'SALE'`.
4. `order`: Updated `payment_method = 'CASHFREE'`, `metadata.kot_number`.
5. `customer_notification_queue`: Queues transactional customer SMS/WhatsApp notifications.
6. `invoice`: Statutory `CH` tax invoices allocated upon delivery.
7. `accounting_voucher`: Zero-variance journal vouchers posted upon delivery.
