import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * POST /admin/crm/templates/:id/test-send
 * Admin — Render and dispatch a test email using the given template.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;
  const { variables } = req.body as any;

  try {
    const rendered = await crmService.renderTemplate(id, variables || {});
    return res.status(200).json({ rendered });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
