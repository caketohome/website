const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/lib/services/cashfree-payment.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Update inventory_movement insert in cashfree-payment.service.ts
content = content.replace(
  `INSERT INTO public.inventory_movement (
              id, branch_id, product_id, change_quantity, previous_quantity,
              new_quantity, movement_type, reference_id, created_at, notes, direction
            ) VALUES (
              $1, $2, $3, $4, 0, 0, 'SALE', $5, NOW(), 'Order confirmed via Cashfree payment', 'OUT'
            );`,
  `INSERT INTO public.inventory_movement (
              id, branch_id, product_id, quantity, direction, movement_type, order_id, narration, created_at
            ) VALUES (
              $1, $2, $3, $4, 'OUT', 'SALE', $5, 'Order confirmed via Cashfree payment', NOW()
            );`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed inventory_movement insert in cashfree-payment.service.ts');

