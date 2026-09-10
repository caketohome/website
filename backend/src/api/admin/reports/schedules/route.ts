import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/reports/schedules
 * Admin — List report schedules.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
  const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);

  try {
    const schedules = await analyticsService.listReportSchedules(req.filterableFields || {}, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    });
    return res.status(200).json({
      schedules,
      count: (schedules || []).length,
      limit,
      offset,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasNextPage: (schedules || []).length >= limit,
        hasPreviousPage: offset > 0,
      },
    });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/reports/schedules
 * Admin — Register a new report schedule.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;
  const payload = req.body as any;

  try {
    const schedule = await analyticsService.createReportSchedule(payload);
    return res.status(201).json({ schedule });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
