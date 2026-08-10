import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const status = req.query.status as string | undefined;
    const filter: any = {};
    if (status) filter.status = status;
    const shapes = await catalogModule.listShapeMasters(filter);
    const filtered = q
      ? shapes.filter((s: any) => s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q)))
      : shapes;
    return res.status(200).json({ shapes: filtered });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to list shapes" });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    const body = req.body as any;
    const created = await catalogModule.createShapeMasters({
      name: body.name,
      image_url: body.image_url || null,
      preview_url: body.preview_url || null,
      description: body.description || null,
      additional_price: body.additional_price ? parseFloat(body.additional_price) : 0,
      max_weight: body.max_weight ? parseFloat(body.max_weight) : 10,
      prep_time_minutes: body.prep_time_minutes ? parseInt(body.prep_time_minutes, 10) : 0,
      sort_order: body.sort_order ? parseInt(body.sort_order, 10) : 0,
      status: body.status || "active",
      is_enabled: body.is_enabled !== undefined ? Boolean(body.is_enabled) : true,
    });
    return res.status(200).json({ shape: created });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to create shape" });
  }
}

