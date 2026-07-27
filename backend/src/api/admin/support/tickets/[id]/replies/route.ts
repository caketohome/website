import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../../modules/support";

/**
 * POST /admin/support/tickets/:id/replies
 * Admin — Post ticket replies from agent.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const { message } = req.body as any;
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    const reply = await supportService.replyToTicket(id, "agent", message);
    return res.status(201).json({ reply });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
