import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../../modules/catalog";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const mappings = await catalogModule.listProductShapeMappings({ product_id: id });
    return res.status(200).json({ shape_mappings: mappings });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to list shape mappings" });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const { mappings } = req.body as any;
    const saved = await catalogModule.saveProductShapeMappings(id, mappings || []);
    return res.status(200).json({ shape_mappings: saved });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to save shape mappings" });
  }
}

