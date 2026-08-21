import { listDeliveries, retrieveDeliveryPartner, retrieveUser } from "../frontend/src/lib/data";
import { ApiEngine } from "../frontend/src/lib/api-engine";

async function test() {
  const store = ApiEngine.getStore();
  console.log("Total orders in store:", store.orders?.length);
  const partner = await retrieveDeliveryPartner("dlp_01", { id: "dlp_01", phone: "+91 99000 11111", role: "DELIVERY_PARTNER" });
  console.log("Resolved partner:", partner);
  const deliveries = await listDeliveries({ delivery_partner_id: partner.id });
  console.log("Deliveries count:", deliveries.length);
  console.log("Deliveries:", deliveries.map(d => ({ id: d.id, order_id: d.order_id, status: d.delivery_status })));
}

test();
