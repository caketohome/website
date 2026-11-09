const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/lib/services/cashfree-payment.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Update insert into payment_webhook_event in confirmOrderPayment
content = content.replace(
  `INSERT INTO public.payment_webhook_event (
          id, provider, event_type, payload, status, created_at
        ) VALUES ($1, 'cashfree', 'PAYMENT_SUCCESS_WEBHOOK', $2, 'processing', NOW());`,
  `INSERT INTO public.payment_webhook_event (
          id, event_id, provider, event_type, order_id, amount, signature, signature_valid, payload, status, created_at
        ) VALUES ($1, $1, 'cashfree', 'PAYMENT_SUCCESS_WEBHOOK', $3, $4, $5, true, $2, 'processing', NOW());`
);

content = content.replace(
  `[eventId, JSON.stringify(rawPayload)]`,
  `[eventId, JSON.stringify(rawPayload), orderId, amount, gatewaySignature]`
);

// Update insert for handlePaymentFailed
content = content.replace(
  `INSERT INTO public.payment_webhook_event (
          id, provider, event_type, payload, status, created_at
        ) VALUES ($1, 'cashfree', 'PAYMENT_FAILED_WEBHOOK', $2, 'processed', NOW())
        ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO public.payment_webhook_event (
          id, event_id, provider, event_type, order_id, signature_valid, payload, status, created_at
        ) VALUES ($1, $1, 'cashfree', 'PAYMENT_FAILED_WEBHOOK', $3, true, $2, 'processed', NOW())
        ON CONFLICT (id) DO NOTHING;`
);

content = content.replace(
  `[eventId, JSON.stringify(rawPayload)]\n      );`,
  `[eventId, JSON.stringify(rawPayload), orderId]\n      );`
);

// Update insert for handlePaymentRefunded
content = content.replace(
  `INSERT INTO public.payment_webhook_event (
          id, provider, event_type, payload, status, created_at
        ) VALUES ($1, 'cashfree', 'REFUND_SUCCESS_WEBHOOK', $2, 'processed', NOW())
        ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO public.payment_webhook_event (
          id, event_id, provider, event_type, order_id, amount, signature_valid, payload, status, created_at
        ) VALUES ($1, $1, 'cashfree', 'REFUND_SUCCESS_WEBHOOK', $3, $4, true, $2, 'processed', NOW())
        ON CONFLICT (id) DO NOTHING;`
);

content = content.replace(
  `[eventId, JSON.stringify(rawPayload)]\n      );`,
  `[eventId, JSON.stringify(rawPayload), orderId, amount]\n      );`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated payment_webhook_event inserts in cashfree-payment.service.ts');

