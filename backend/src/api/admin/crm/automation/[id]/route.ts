import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../modules/crm";

/**
 * GET /admin/crm/automation/:id
 * Admin — Retrieve a single automation flow.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;

  try {
    const flow = await crmService.retrieveAutomationFlow(id);
    return res.status(200).json({
      flow: {
        ...flow,
        steps: flow.steps ? (typeof flow.steps === "string" ? JSON.parse(flow.steps) : flow.steps) : [],
      },
    });
  } catch (error: any) {
    return res.status(404).json({ message: `Automation flow ${id} not found.`, code: "AUTOMATION_NOT_FOUND" });
  }
}

/**
 * POST /admin/crm/automation/:id
 * Admin — Update an automation flow.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;
  const payload = req.body as any;

  try {
    await crmService.retrieveAutomationFlow(id);
  } catch {
    return res.status(404).json({ message: `Automation flow ${id} not found.`, code: "AUTOMATION_NOT_FOUND" });
  }

  try {
    const updateData: Record<string, any> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.trigger_type !== undefined) updateData.trigger_type = payload.trigger_type;
    if (payload.steps !== undefined) updateData.steps = JSON.stringify(payload.steps);
    if (payload.is_active !== undefined) updateData.is_active = !!payload.is_active;

    const updated = await crmService.updateAutomationFlows({
      selector: { id },
      data: updateData,
    });
    return res.status(200).json({ flow: updated[0] });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/crm/automation/:id
 * Admin — Delete an automation flow.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;

  try {
    await crmService.retrieveAutomationFlow(id);
  } catch {
    return res.status(404).json({ message: `Automation flow ${id} not found.`, code: "AUTOMATION_NOT_FOUND" });
  }

  try {
    await crmService.deleteAutomationFlows([id]);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
