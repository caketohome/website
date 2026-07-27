import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import SupportModuleService from "../../../../../../modules/support/service";

/**
 * GET /store/support/chat/messages/stream
 * Storefront — Establish Server-Sent Events stream for real-time live chat replies.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) {
    return res.status(400).json({ message: "sessionId parameter is required.", code: "SUPPORT_VALIDATION_FAILED" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  res.write("data: connected\n\n");

  const listener = (message: any) => {
    if (message.session_id === sessionId) {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    }
  };

  SupportModuleService.chatEmitter.on("message", listener);

  req.on("close", () => {
    SupportModuleService.chatEmitter.off("message", listener);
    res.end();
  });
}
