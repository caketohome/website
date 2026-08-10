import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/analytics/dashboard
 * Admin — Fetch Owner Dashboard aggregations (revenue, expenses, trends, breakdowns).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  const { branch_id, branch_ids: rawBranchIds, franchise_id, interval } = req.query as Record<string, string>;
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;

  let branch_ids: string[] | undefined;
  if (rawBranchIds) {
    branch_ids = Array.isArray(rawBranchIds) ? (rawBranchIds as string[]) : (rawBranchIds as string).split(",");
  }

  let from: Date | undefined;
  let to: Date | undefined;

  try {
    if (fromStr) {
      from = new Date(fromStr);
      if (isNaN(from.getTime())) {
        return res.status(400).json({ message: "Invalid 'from' date parameter.", code: "ANALYTICS_VALIDATION_FAILED" });
      }
    }
    if (toStr) {
      to = new Date(toStr);
      if (isNaN(to.getTime())) {
        return res.status(400).json({ message: "Invalid 'to' date parameter.", code: "ANALYTICS_VALIDATION_FAILED" });
      }
    }

    const summary = await analyticsService.getDashboardSummary({
      from,
      to,
      branch_id,
      branch_ids,
      franchise_id,
      interval: (interval as any) || "daily",
    });

    return res.status(200).json(summary);
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
