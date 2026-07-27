import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../../modules/analytics";

/**
 * GET /admin/reports/schedules/:id
 * Admin — Retrieve a single report schedule.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    const schedule = await analyticsService.getReportSchedule(id);
    return res.status(200).json({ schedule });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/reports/schedules/:id
 * Admin — Update a report schedule.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;
  const payload = req.body as any;

  try {
    const schedule = await analyticsService.updateReportSchedule(id, payload);
    return res.status(200).json({ schedule });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/reports/schedules/:id
 * Admin — Delete a report schedule.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    await analyticsService.deleteReportSchedule(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
