import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/reports/staff-performance
 * Admin — Fetch staff delivery success metrics.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  const branch_id = req.query.branch_id as string | undefined;
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;

  let from: Date | undefined;
  let to: Date | undefined;

  try {
    if (fromStr) {
      from = new Date(fromStr);
      if (isNaN(from.getTime())) {
        return res.status(400).json({ message: "Invalid 'from' date parameter.", code: "REPORTS_VALIDATION_FAILED" });
      }
    }
    if (toStr) {
      to = new Date(toStr);
      if (isNaN(to.getTime())) {
        return res.status(400).json({ message: "Invalid 'to' date parameter.", code: "REPORTS_VALIDATION_FAILED" });
      }
    }

    const report = await analyticsService.getStaffPerformanceReport({
      from,
      to,
      branch_id,
    });

    return res.status(200).json({ report });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
