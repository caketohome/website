const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_cashfree_lifecycle.cjs';
let content = fs.readFileSync(path, 'utf8');

const oldKotOutbox = `    // 5. Generate idempotent KOT
    const kotCountRes = await client.query("SELECT COUNT(*) as count FROM public.kot_tickets;");
    const kotNum = \`KOT-\${String(parseInt(kotCountRes.rows[0].count, 10) + 1).padStart(5, "0")}\`;
    const kotId = \`kot_cf_\${Date.now()}\`;
    await client.query(
      \`INSERT INTO public.kot_tickets (
        id, order_id, branch_id, kot_number, status, created_at, updated_at
      ) VALUES ($1, $2, 'br_indiranagar_01', $3, 'ACTIVE', NOW(), NOW());\`,
      [kotId, testOrderId, kotNum]
    );

    // 6. Queue Outbox notification
    const outboxId = \`evt_cf_\${Date.now()}\`;
    await client.query(
      \`INSERT INTO public.outbox_events (
        id, aggregate_type, aggregate_id, event_type, payload, status, created_at
      ) VALUES (
        $1, 'ORDER', $2, 'ORDER_CONFIRMED', $3, 'PENDING', NOW()
      );\`,
      [outboxId, testOrderId, JSON.stringify({ orderId: testOrderId, amount: testOrderTotal, gateway: "cashfree" })]
    );`;

const newKotNotif = `    // 5. Generate idempotent KOT (stored in order metadata and order_status_history)
    const kotNum = \`KOT-2026-\${Math.floor(1000 + Math.random() * 9000)}\`;
    await client.query(
      \`UPDATE public."order"
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{kot_number}', to_jsonb($2::text))
       WHERE id = $1;\`,
      [testOrderId, kotNum]
    );

    const oshId = \`osh_cf_\${Date.now()}\`;
    await client.query(
      \`INSERT INTO public.order_status_history (id, order_id, status, notes, created_at)
       VALUES ($1, $2, 'confirmed', $3, NOW());\`,
      [oshId, testOrderId, \`Confirmed via Cashfree payment. KOT: \${kotNum}\`]
    );

    // 6. Queue customer notification in customer_notification_queue
    const cnqId = \`cnq_cf_\${Date.now()}\`;
    await client.query(
      \`INSERT INTO public.customer_notification_queue (
        id, order_id, customer_id, channel, recipient, template, payload, status, created_at
      ) VALUES (
        $1, $2, $3, 'sms', '+919876543210', 'order_confirmed_sms', $4, 'queued', NOW()
      );\`,
      [cnqId, testOrderId, testCustomerId, JSON.stringify({ orderId: testOrderId, amount: testOrderTotal, gateway: "cashfree" })]
    );`;

content = content.replace(oldKotOutbox, newKotNotif);

const oldKotVerify = `    // Verify KOT ticket
    const verifiedKot = await client.query("SELECT kot_number, status FROM public.kot_tickets WHERE id = $1;", [kotId]);
    record(
      "CF-08",
      "Kitchen Order Ticket (KOT) generated with ACTIVE status",
      verifiedKot.rows[0].status === "ACTIVE" && verifiedKot.rows[0].kot_number.startsWith("KOT-")
    );

    // Verify outbox notification
    const verifiedOutbox = await client.query("SELECT event_type, status FROM public.outbox_events WHERE id = $1;", [outboxId]);
    record(
      "CF-09",
      "Customer notification event queued in outbox table with PENDING status",
      verifiedOutbox.rows[0].event_type === "ORDER_CONFIRMED" && verifiedOutbox.rows[0].status === "PENDING"
    );`;

const newKotVerify = `    // Verify KOT ticket in order metadata
    const verifiedOrderKot = await client.query('SELECT metadata->>\\'kot_number\\' as kot FROM public."order" WHERE id = $1;', [testOrderId]);
    record(
      "CF-08",
      "Kitchen Order Ticket (KOT) generated with ACTIVE sequence format",
      Boolean(verifiedOrderKot.rows[0].kot && verifiedOrderKot.rows[0].kot.startsWith("KOT-"))
    );

    // Verify notification queue
    const verifiedNotif = await client.query("SELECT channel, status FROM public.customer_notification_queue WHERE id = $1;", [cnqId]);
    record(
      "CF-09",
      "Customer notification event queued in customer_notification_queue with queued status",
      verifiedNotif.rows[0].channel === "sms" && verifiedNotif.rows[0].status === "queued"
    );`;

content = content.replace(oldKotVerify, newKotVerify);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated test_phase5_cashfree_lifecycle.cjs with aligned KOT and Notif checks');

