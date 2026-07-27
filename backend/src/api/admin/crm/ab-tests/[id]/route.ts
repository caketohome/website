import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../modules/crm";

/**
 * GET /admin/crm/ab-tests/:id
 * Admin — Retrieve A/B test details with parsed metrics.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;

  try {
    const test = await crmService.getABTest(id);
    return res.status(200).json({ test });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/ab-tests/:id
 * Admin — Update an A/B test.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;
  const payload = req.body as any;

  try {
    const test = await crmService.updateABTest(id, payload);
    return res.status(200).json({ test });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/crm/ab-tests/:id
 * Admin — Delete an A/B test.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const { id } = req.params;

  try {
    await crmService.retrieveABTest(id);
  } catch {
    return res.status(404).json({ message: `A/B Test ${id} not found.`, code: "AB_TEST_NOT_FOUND" });
  }

  try {
    await crmService.deleteABTests([id]);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
