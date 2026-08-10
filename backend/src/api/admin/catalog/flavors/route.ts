import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const status = req.query.status as string | undefined;
    const filter: any = {};
    if (status) filter.status = status;
    const flavors = await catalogModule.listFlavorMasters(filter);
    const filtered = q
      ? flavors.filter((f: any) =>
          f.name.toLowerCase().includes(q) ||
          (f.display_name && f.display_name.toLowerCase().includes(q)) ||
          (f.internal_code && f.internal_code.toLowerCase().includes(q))
        )
      : flavors;
    return res.status(200).json({ flavors: filtered });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to list flavors" });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    const body = req.body as any;
    const created = await catalogModule.createFlavorMasters({
      name: body.name,
      display_name: body.display_name || body.name,
      internal_code: body.internal_code || null,
      description: body.description || null,
      image_url: body.image_url || null,
      icon: body.icon || null,
      color: body.color || null,
      extra_price: body.extra_price ? parseFloat(body.extra_price) : 0,
      prep_time_minutes: body.prep_time_minutes ? parseInt(body.prep_time_minutes, 10) : 0,
      sort_order: body.sort_order ? parseInt(body.sort_order, 10) : 0,
      status: body.status || "active",
      is_enabled: body.is_enabled !== undefined ? Boolean(body.is_enabled) : true,
      available_online: body.available_online !== undefined ? Boolean(body.available_online) : true,
      available_in_store: body.available_in_store !== undefined ? Boolean(body.available_in_store) : true,
      available_for_pickup: body.available_for_pickup !== undefined ? Boolean(body.available_for_pickup) : true,
      available_for_delivery: body.available_for_delivery !== undefined ? Boolean(body.available_for_delivery) : true,
    });
    return res.status(200).json({ flavor: created });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to create flavor" });
  }
}

