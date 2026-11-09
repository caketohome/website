const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_cashfree_lifecycle.cjs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `INSERT INTO public.inventory_movement (
        id, branch_id, product_id, change_quantity, previous_quantity, new_quantity,
        movement_type, reference_id, created_at, notes, direction
      ) VALUES (
        $1, 'branch_koramangala', 'prod_test_cf', -1, 10, 9,
        'SALE', $2, NOW(), 'Cashfree payment confirmation', 'OUT'
      );`,
  `INSERT INTO public.inventory_movement (
        id, branch_id, product_id, quantity, direction,
        movement_type, order_id, narration, created_at
      ) VALUES (
        $1, 'branch_koramangala', 'prod_test_cf', 1, 'OUT',
        'SALE', $2, 'Cashfree payment confirmation', NOW()
      );`
);

content = content.replace(
  `const verifiedMv = await client.query("SELECT direction, change_quantity FROM public.inventory_movement WHERE id = $1;", [mvId]);
    record(
      "CF-07",
      "Inventory movement recorded with direction = OUT and negative quantity",
      verifiedMv.rows[0].direction === "OUT" && Number(verifiedMv.rows[0].change_quantity) === -1
    );`,
  `const verifiedMv = await client.query("SELECT direction, quantity FROM public.inventory_movement WHERE id = $1;", [mvId]);
    record(
      "CF-07",
      "Inventory movement recorded with direction = OUT and positive quantity",
      verifiedMv.rows[0].direction === "OUT" && Number(verifiedMv.rows[0].quantity) === 1
    );`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed inventory_movement in test_phase5_cashfree_lifecycle.cjs');

