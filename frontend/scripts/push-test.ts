/**
 * Local test for PWA order alerts. Sends the same notification an order status change would.
 *   npx tsx scripts/push-test.ts <customer_uid | branch:<id> | partner:<id>> [status]
 * Example: npx tsx scripts/push-test.ts cth_cus_9605725337 out_for_delivery
 */
import { notifyDeliveryAssigned, notifyOrderCreated, notifyOrderStatus } from "../src/lib/services/push-notification.service";
import { dbQuery } from "../src/lib/db";

async function main() {
  const [target, status = "out_for_delivery"] = process.argv.slice(2);
  if (!target) throw new Error("Usage: push-test.ts <customer_uid | branch:<id> | partner:<id>> [status]");
  const order = { id: "test_order", order_number: "TEST-001" };

  const { rows } = await dbQuery(`SELECT role, branch_id, partner_id, customer_uid, left(user_agent, 60) ua FROM public.push_subscription`);
  console.log("subscriptions:", rows);

  if (target.startsWith("branch:")) notifyOrderCreated({ ...order, branch_id: target.slice(7) });
  else if (target.startsWith("partner:")) notifyDeliveryAssigned(order, target.slice(8));
  else notifyOrderStatus({ ...order, customer_uid: target }, status);

  await new Promise((r) => setTimeout(r, 4000)); // notify* is fire-and-forget
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
