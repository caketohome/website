import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import SupportModuleService from "../../../../../../modules/support/service";

/**
 * GET /admin/support/chat/messages/stream
 * Admin — SSE message stream dispatcher for support console workspaces.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  res.write("data: connected\n\n");

  const listener = (message: any) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  SupportModuleService.chatEmitter.on("message", listener);

  req.on("close", () => {
    SupportModuleService.chatEmitter.off("message", listener);
    res.end();
  });
}
