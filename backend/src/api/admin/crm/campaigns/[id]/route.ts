import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../modules/crm";

/**
 * GET /admin/crm/campaigns/:id
 * Admin — Retrieve a CRM campaign by ID.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const campaign = await crmService.getCampaign(id);
    return res.status(200).json({ campaign });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * PATCH /admin/crm/campaigns/:id
 * Admin — Update a CRM campaign.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const payload = req.body as any;

  try {
    let campaign;
    if (payload.status === "archived") {
      campaign = await crmService.archiveCampaign(id);
    } else {
      campaign = await crmService.updateCampaign(id, payload);
    }
    return res.status(200).json({ campaign });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/crm/campaigns/:id
 * Admin — Delete a CRM campaign.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    await crmService.deleteCampaign(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
