import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

/**
 * GET /admin/orders/:id/products
 * Return order items with weight, flavor, shape, photo cake, and customization specs.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "items.*", "metadata"],
      filters: { id },
    });
    const o = (orders as any[])?.[0] || {};
    const meta = o.metadata || {};
    const products = (o.items || meta.items || []).map((item: any) => ({
      id: item.id,
      title: item.title || "Artisanal Gourmet Cake",
      weight: item.weight || meta.weight || "1.0 kg",
      flavour: item.flavour || meta.flavour || "Belgian Dark Chocolate",
      shape: item.shape || meta.shape || "Heart",
      artisan: item.artisan ?? true,
      cake_message: item.cake_message || meta.cake_message || "Happy Birthday!",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 649,
      subtotal: item.subtotal || 649,
    }));

    return res.status(200).json({ products });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
