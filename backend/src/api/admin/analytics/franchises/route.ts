import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/analytics/franchises
 * Admin — List franchise agreements.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    const franchises = await analyticsService.listFranchises(req.filterableFields, req.listConfig);
    return res.status(200).json({ franchises });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/analytics/franchises
 * Admin — Create a franchise agreement.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;
  const payload = req.body as any;

  try {
    const franchise = await analyticsService.createFranchise({
      ...payload,
      created_by: actorId,
    });
    return res.status(201).json({ franchise });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
