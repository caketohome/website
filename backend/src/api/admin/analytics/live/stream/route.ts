import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import AnalyticsModuleService from "../../../../../modules/analytics/service";

/**
 * GET /admin/analytics/live/stream
 * Admin — Exposes real-time analytics events as an SSE stream.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Write initial heartbeat
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date() })}\n\n`);

  const onEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  AnalyticsModuleService.emitter.on("event", onEvent);

  req.on("close", () => {
    AnalyticsModuleService.emitter.off("event", onEvent);
  });
}
