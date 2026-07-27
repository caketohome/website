import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../../modules/support";

/**
 * POST /admin/support/tickets/:id/workflow
 * Admin — Handle ticket workflows (assignment and status updates).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const { action, assigned_to, status: nextStatus } = req.body as any;
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    let ticket;
    if (action === "assign") {
      if (!assigned_to) {
        return res.status(400).json({ message: "assigned_to is required for assignment", code: "SUPPORT_VALIDATION_FAILED" });
      }
      ticket = await supportService.assignTicket(id, assigned_to);
    } else if (action === "status") {
      if (!nextStatus) {
        return res.status(400).json({ message: "status is required", code: "SUPPORT_VALIDATION_FAILED" });
      }
      ticket = await supportService.resolveTicket(id, nextStatus);
    } else {
      return res.status(400).json({ message: `Unsupported action: ${action}`, code: "SUPPORT_VALIDATION_FAILED" });
    }

    return res.status(200).json({ ticket });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
