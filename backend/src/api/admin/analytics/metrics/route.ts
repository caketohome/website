import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/analytics/metrics?metric=visitors&from=...&to=...&branch_id=...
 * Compute a named metric for dashboards/reports.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;

  const metric = req.query.metric as string;
  if (!metric) {
    return res.status(400).json({ message: "metric is required", code: "ANALYTICS_VALIDATION_FAILED" });
  }

  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  const branch_id = req.query.branch_id as string | undefined;

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

    const result = await analyticsModule.computeMetric(metric, {
      from,
      to,
      branch_id,
    });

    return res.status(200).json({ result });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

