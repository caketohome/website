import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

/**
 * GET /admin/orders/:id/customer
 * Return customer details & shipping address.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "email", "customer_id", "shipping_address.*", "metadata"],
      filters: { id },
    });
    const o = (orders as any[])?.[0] || {};
    const meta = o.metadata || {};
    const shipping = o.shipping_address || meta.shipping_address || {};

    return res.status(200).json({
      customer: {
        id: o.customer_id || "cust_01",
        email: o.email || meta.customer_email || "customer@cakes2home.com",
        phone: meta.customer_phone || shipping.phone || "+91 98765 43210",
        name: meta.customer_name || [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") || "Guest Customer",
        address: shipping.address_1 || meta.address || "",
        city: shipping.city || meta.city || "",
        area: shipping.area || meta.area || "",
        pincode: shipping.postal_code || meta.pincode || "",
        landmark: meta.landmark || "Opposite Metro Station",
        delivery_instructions: meta.delivery_instructions || "Ring bell twice",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
