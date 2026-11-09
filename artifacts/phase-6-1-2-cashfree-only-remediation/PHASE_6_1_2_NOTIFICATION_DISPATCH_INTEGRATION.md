# CAKETOHOME — PHASE 6.1.2 NOTIFICATION DISPATCH INTEGRATION
## EVENT-DRIVEN NOTIFICATIONS, SMS/WHATSAPP DISPATCH & OUTBOX LOGGING

**Company:** CakeToHome India Private Limited  
**Architecture:** Outbox Pattern & Notification Broker

---

### 1. OUTBOX EVENT PIPELINE

Payment confirmation writes an event to `public.outbox_events`:
```json
{
  "aggregate_type": "order",
  "aggregate_id": "CTH-2026-XXXX",
  "event_type": "payment.confirmed",
  "payload": {
    "order_id": "CTH-2026-XXXX",
    "amount": 525.00,
    "payment_gateway": "cashfree",
    "cf_payment_id": "cf_pay_...",
    "customer_phone": "9876543210",
    "customer_email": "ananya.sharma@example.com",
    "branch_id": "br_indiranagar_01",
    "kot_number": "KOT-00005"
  }
}
```

### 2. DISPATCH CHANNELS

1. **Customer SMS / WhatsApp:** "Thank you for your order CTH-2026-XXXX with CakeToHome! Your Chocolate Truffle Cake is now being prepared by our chefs at Indiranagar Kitchen. Track live: http://caketohome.in/your-order?order_id=..."
2. **Branch Kitchen Alert:** Audio chime and visual flash on Branch Manager dashboard (`/branch-manager`).
