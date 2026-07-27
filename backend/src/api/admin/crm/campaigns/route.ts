import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../modules/crm";

/**
 * GET /admin/crm/campaigns
 * Admin — List CRM campaigns.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const campaigns = await crmService.listCampaigns(req.filterableFields, req.listConfig);
    return res.status(200).json({ campaigns });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/campaigns
 * Admin — Create a new CRM campaign.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const payload = req.body as any;

  try {
    const campaign = await crmService.createCampaign({
      ...payload,
      created_by: actorId,
    });
    return res.status(201).json({ campaign });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
