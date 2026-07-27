import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * POST /admin/crm/automation/:id/trigger
 * Admin — Manually trigger an automation flow for testing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;
  const { customer_id, payload } = req.body as any;

  if (!customer_id) {
    return res.status(400).json({ message: "customer_id is required.", code: "AUTOMATION_VALIDATION_FAILED" });
  }

  try {
    const flow = await crmService.retrieveAutomationFlow(id);
    await crmService.triggerAutomationFlow(flow.trigger_type, customer_id, payload);
    return res.status(200).json({ success: true, message: `Flow ${id} triggered for customer ${customer_id}.` });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code || "AUTOMATION_TRIGGER_FAILED" });
  }
}
