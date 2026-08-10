import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    const flavors = await catalogModule.listFlavorMasters({ status: "active", is_enabled: true });
    const shapes = await catalogModule.listShapeMasters({ status: "active", is_enabled: true });
    return res.status(200).json({ flavors, shapes });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to fetch storefront options" });
  }
}

