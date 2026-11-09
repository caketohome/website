const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/lib/services/cashfree-payment.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace kot_tickets and outbox_events block with order.metadata kot and customer_notification_queue
const oldBlock = `      // 7. Idempotent KOT Generation
      const existingKot = await txClient.query(
        "SELECT id, kot_number FROM public.kot_tickets WHERE order_id = $1 LIMIT 1;",
        [orderId]
      );

      let kotNumber = existingKot.rows.length > 0 ? existingKot.rows[0].kot_number : null;

      if (!kotNumber) {
        const kotCountRes = await txClient.query("SELECT COUNT(*) as count FROM public.kot_tickets;");
        const nextNum = parseInt(kotCountRes.rows[0].count, 10) + 1;
        kotNumber = \`KOT-\${String(nextNum).padStart(5, "0")}\`;
        const kotId = \`kot_\${Date.now()}_\${crypto.randomBytes(3).toString("hex")}\`;

        await txClient.query(
          \`INSERT INTO public.kot_tickets (
            id, order_id, branch_id, kot_number, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW());\`,
          [kotId, orderId, order.branch_id || "br_indiranagar_01", kotNumber]
        );
      }

      // 8. Enqueue Outbox Notification Event
      const outboxId = \`evt_\${Date.now()}_\${crypto.randomBytes(4).toString("hex")}\`;
      await txClient.query(
        \`INSERT INTO public.outbox_events (
          id, aggregate_type, aggregate_id, event_type, payload, status, created_at
        ) VALUES (
          $1, 'ORDER', $2, 'ORDER_CONFIRMED', $3, 'PENDING', NOW()
        );\`,
        [
          outboxId,
          orderId,
          JSON.stringify({
            order_id: orderId,
            customer_id: order.customer_id,
            amount,
            kot_number: kotNumber,
            gateway: "cashfree",
          }),
        ]
      );`;

const newBlock = `      // 7. Idempotent KOT Generation (Saved in order.metadata and order_status_history)
      const kotNumber = order.metadata?.kot_number || \`KOT-\${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-\${Math.floor(1000 + Math.random() * 9000)}\`;
      await txClient.query(
        \`UPDATE public."order" 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{kot_number}', to_jsonb($2::text))
         WHERE id = $1;\`,
        [orderId, kotNumber]
      );

      const oshId = \`osh_cf_\${Date.now()}_\${crypto.randomBytes(3).toString("hex")}\`;
      await txClient.query(
        \`INSERT INTO public.order_status_history (id, order_id, status, notes, created_at)
         VALUES ($1, $2, 'confirmed', $3, NOW());\`,
        [oshId, orderId, \`Confirmed via Cashfree payment. KOT: \${kotNumber}\`]
      );

      // 8. Enqueue Customer Notification
      const cnqId = \`cnq_cf_\${Date.now()}_\${crypto.randomBytes(3).toString("hex")}\`;
      await txClient.query(
        \`INSERT INTO public.customer_notification_queue (
          id, order_id, customer_id, channel, recipient, template, payload, status, created_at
        ) VALUES (
          $1, $2, $3, 'sms', $4, 'order_confirmed_sms', $5, 'queued', NOW()
        );\`,
        [
          cnqId,
          orderId,
          order.customer_id,
          order.customer_phone || "+919876543210",
          JSON.stringify({
            order_id: orderId,
            amount,
            kot_number: kotNumber,
            gateway: "cashfree",
          }),
        ]
      );`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully aligned KOT and Notification queue in cashfree-payment.service.ts');

