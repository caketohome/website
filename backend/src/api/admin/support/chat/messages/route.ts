import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../modules/support";

/**
 * POST /admin/support/chat/messages
 * Admin — Agent reply in a chat session.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;
  const { session_id, message } = req.body as any;

  if (!session_id || !message) {
    return res.status(400).json({ message: "session_id and message are required.", code: "SUPPORT_VALIDATION_FAILED" });
  }

  try {
    const chatMsg = await supportService.sendChatMessage(session_id, "agent", message);
    return res.status(201).json({ message: chatMsg });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
