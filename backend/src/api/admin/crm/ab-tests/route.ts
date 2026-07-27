import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../modules/crm";

/**
 * GET /admin/crm/ab-tests
 * Admin — List A/B tests.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const rawTests = await crmService.listABTests(req.filterableFields || {});
    const tests = rawTests.map((t: any) => ({
      ...t,
      metrics_a: typeof t.metrics_a === "string" ? JSON.parse(t.metrics_a) : t.metrics_a,
      metrics_b: typeof t.metrics_b === "string" ? JSON.parse(t.metrics_b) : t.metrics_b,
    }));
    return res.status(200).json({ tests });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/ab-tests
 * Admin — Create a new A/B test.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const payload = req.body as any;

  try {
    const test = await crmService.createABTest(payload);
    return res.status(201).json({ test });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
