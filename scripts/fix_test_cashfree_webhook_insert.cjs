const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_cashfree_lifecycle.cjs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `INSERT INTO public.payment_webhook_event (
        id, provider, event_type, payload, status, created_at
      ) VALUES ($1, 'cashfree', 'PAYMENT_SUCCESS_WEBHOOK', '{}'::jsonb, 'processing', NOW());`,
  `INSERT INTO public.payment_webhook_event (
        id, event_id, provider, event_type, order_id, amount, signature, signature_valid, payload, status, created_at
      ) VALUES ($1, $1, 'cashfree', 'PAYMENT_SUCCESS_WEBHOOK', $2, $3, $4, true, '{}'::jsonb, 'processing', NOW());`
);

content = content.replace(
  `[eventId]\n    );`,
  `[eventId, testOrderId, testOrderTotal, validSignature]\n    );`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated test_phase5_cashfree_lifecycle.cjs webhook insert');

