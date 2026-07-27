import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../../modules/analytics";

/**
 * GET /admin/analytics/expenses/:id
 * Admin — Retrieve an expense.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    const expense = await analyticsService.getExpense(id);
    return res.status(200).json({ expense });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * PATCH /admin/analytics/expenses/:id
 * Admin — Update an expense.
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
    const expense = await analyticsService.updateExpense(id, payload);
    return res.status(200).json({ expense });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/analytics/expenses/:id
 * Admin — Delete an expense.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  try {
    await analyticsService.deleteExpense(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
