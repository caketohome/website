import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../../modules/analytics";

/**
 * GET /admin/analytics/franchises/:id
 * Admin — Retrieve a franchise agreement.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    const franchise = await analyticsService.getFranchise(id);
    return res.status(200).json({ franchise });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * PATCH /admin/analytics/franchises/:id
 * Admin — Update a franchise agreement.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;
  const payload = req.body as any;

  try {
    const franchise = await analyticsService.updateFranchise(id, payload);
    return res.status(200).json({ franchise });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/analytics/franchises/:id
 * Admin — Delete a franchise agreement.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    await analyticsService.deleteFranchise(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
