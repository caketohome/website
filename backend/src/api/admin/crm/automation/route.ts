import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../modules/crm";

/**
 * GET /admin/crm/automation
 * Admin — List automation flows.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const rawFlows = await crmService.listAutomationFlows(req.filterableFields || {});
    const flows = rawFlows.map((f: any) => ({
      ...f,
      steps: f.steps ? (typeof f.steps === "string" ? JSON.parse(f.steps) : f.steps) : [],
    }));
    return res.status(200).json({ flows });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/automation
 * Admin — Create a new automation flow.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const payload = req.body as any;

  if (!payload.name || !payload.name.trim()) {
    return res.status(400).json({ message: "Flow name is required.", code: "AUTOMATION_VALIDATION_FAILED" });
  }
  if (!payload.trigger_type) {
    return res.status(400).json({ message: "Trigger type is required.", code: "AUTOMATION_VALIDATION_FAILED" });
  }

  try {
    const data = {
      name: payload.name.trim(),
      trigger_type: payload.trigger_type,
      steps: payload.steps ? JSON.stringify(payload.steps) : null,
      is_active: payload.is_active ?? false,
    };
    const created = await crmService.createAutomationFlows([data]);
    return res.status(201).json({ flow: created[0] });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
