const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_cashfree_lifecycle.cjs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `INSERT INTO public.order_status_history (id, order_id, status, notes, created_at)
       VALUES ($1, $2, 'confirmed', $3, NOW());`,
  `INSERT INTO public.order_status_history (id, order_id, from_status, to_status, actor_type, reason, created_at, updated_at)
       VALUES ($1, $2, 'pending', 'confirmed', 'system', $3, NOW(), NOW());`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed order_status_history in test_phase5_cashfree_lifecycle.cjs');

