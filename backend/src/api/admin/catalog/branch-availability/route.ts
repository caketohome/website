import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { CATALOG_MODULE } from "../../../../modules/catalog";

const postSchema = zod.object({
  branch_id: zod.string(),
  product_id: zod.string(),
  status: zod.enum(["available", "out_of_stock", "hidden"]),
  preparation_time_minutes: zod.number().optional(),
  is_same_day_eligible: zod.boolean().optional(),
});

/**
 * GET /admin/catalog/branch-availability?branch_id=...
 * Admin & Branch Staff endpoint: List product availability overrides for a branch.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModuleService = req.scope.resolve(CATALOG_MODULE) as any;
  const branchId = req.query.branch_id as string;
  try {
    const filters = branchId ? { branch_id: branchId } : {};
    const availabilities = await catalogModuleService.listBranchProductAvailabilities(filters).catch(() => []);
    return res.status(200).json({ availabilities });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * POST /admin/catalog/branch-availability
 * Branch Staff & Admin endpoint: Toggle product availability status (Available, Out of Stock, Hidden) for a branch.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid availability body.", errors: parsed.error.flatten() });
  }

  const catalogModuleService = req.scope.resolve(CATALOG_MODULE) as any;
  try {
    // Check if existing record exists
    const [existing] = await catalogModuleService.listBranchProductAvailabilities({
      branch_id: parsed.data.branch_id,
      product_id: parsed.data.product_id,
    }).catch(() => []);

    let record;
    if (existing) {
      record = await catalogModuleService.updateBranchProductAvailabilities({
        id: existing.id,
        ...parsed.data,
      });
    } else {
      record = await catalogModuleService.createBranchProductAvailabilities([parsed.data]);
    }

    return res.status(200).json({ availability: Array.isArray(record) ? record[0] : record });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
