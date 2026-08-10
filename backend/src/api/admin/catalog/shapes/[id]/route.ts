import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const body = req.body as any;
    const updated = await catalogModule.updateShapeMasters({
      selector: { id },
      data: body,
    });
    return res.status(200).json({ shape: updated[0] });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to update shape" });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const usageCount = await catalogModule.checkShapeUsage(id);
    if (usageCount > 0 && req.query.force !== "true") {
      return res.status(409).json({
        message: `Shape is mapped to ${usageCount} active product(s). Archive or disable it instead, or pass force=true to remove.`,
        usage_count: usageCount,
      });
    }
    await catalogModule.deleteShapeMasters(id);
    return res.status(200).json({ id, deleted: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to delete shape" });
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const body = req.body as any;
    const updated = await catalogModule.updateShapeMasters({
      selector: { id },
      data: body,
    });
    return res.status(200).json({ shape: updated[0] });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to patch shape" });
  }
}

