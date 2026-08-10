import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

/**
 * GET /admin/orders/:id/details
 * Return full order aggregate details.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "status", "total", "subtotal", "tax_total", "created_at", "email", "shipping_address.*", "items.*", "metadata"],
      filters: { id },
    });
    const o = (orders as any[])?.[0] || { id, display_id: id };
    return res.status(200).json({ details: o });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to fetch details" });
  }
}
