import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /health/live
 * Public Liveness Check.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({
    status: "live",
    timestamp: new Date().toISOString(),
  });
}
