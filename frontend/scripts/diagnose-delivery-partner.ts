import { retrieveDeliveryPartner } from "../src/lib/data/delivery-partners";
import { listDeliveries } from "../src/lib/data/deliveries";

async function diagnose() {
  const user = {
    id: "admin_01",
    role: "SUPER_ADMIN",
    email: "admin@cakes2home.com",
    first_name: "Super",
    last_name: "Admin"
  };

  const partner = await retrieveDeliveryPartner("admin_01", user);
  const deliveries = await listDeliveries({ delivery_partner_id: partner.id });

  for (let i = 0; i < deliveries.length; i++) {
    const d: any = deliveries[i];
    for (const key of Object.keys(d)) {
      const val = d[key];
      if (typeof val === "object" && val !== null && !["order", "cart"].includes(key)) {
        console.log(`[Delivery #${i} id=${d.id}] Suspicious object in d.${key}:`, val);
      }
    }
    if (d.recipient_name && typeof d.recipient_name === "object") {
      console.log(`[Delivery #${i}] recipient_name is object:`, d.recipient_name);
    }
    if (d.recipient_address && typeof d.recipient_address === "object") {
      console.log(`[Delivery #${i}] recipient_address is object:`, d.recipient_address);
    }
    if (d.recipient_phone && typeof d.recipient_phone === "object") {
      console.log(`[Delivery #${i}] recipient_phone is object:`, d.recipient_phone);
    }
    if (d.recipient_pincode && typeof d.recipient_pincode === "object") {
      console.log(`[Delivery #${i}] recipient_pincode is object:`, d.recipient_pincode);
    }
    if (d.recipient_landmark && typeof d.recipient_landmark === "object") {
      console.log(`[Delivery #${i}] recipient_landmark is object:`, d.recipient_landmark);
    }
    if (d.delivery_instructions && typeof d.delivery_instructions === "object") {
      console.log(`[Delivery #${i}] delivery_instructions is object:`, d.delivery_instructions);
    }
    if (d.gift_message && typeof d.gift_message === "object") {
      console.log(`[Delivery #${i}] gift_message is object:`, d.gift_message);
    }
    if (d.delivery_otp && typeof d.delivery_otp === "object") {
      console.log(`[Delivery #${i}] delivery_otp is object:`, d.delivery_otp);
    }
  }
  console.log("Finished scan of all deliveries!");
}

diagnose().catch(console.error);
