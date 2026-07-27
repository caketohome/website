import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * POST /admin/crm/segments/:id/evaluate
 * Admin — Force re-evaluate segment membership mappings.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    await crmService.evaluateSegmentMemberships(id);
    const mappings = await crmService.listCustomerSegments({ segment_id: id });
    return res.status(200).json({ success: true, customer_count: mappings.length });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
