import { NextRequest } from "next/server";
import { CrossAppEventService } from "@frontend/lib/services/cross-app-event.service";
import { resolveServerSession } from "@frontend/lib/security/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const session = resolveServerSession(req);
  const searchParams = req.nextUrl.searchParams;

  const role = (
    searchParams.get("role") ||
    session?.role ||
    (searchParams.get("shop_id") ? "BRANCH_MANAGER" : "") ||
    (searchParams.get("delivery_partner_id") ? "DELIVERY_PARTNER" : "") ||
    (searchParams.get("customer_id") ? "CUSTOMER" : "ADMIN")
  ).toUpperCase();

  const branchId =
    searchParams.get("branch_id") ||
    searchParams.get("branchId") ||
    searchParams.get("shop_id") ||
    session?.branchId ||
    null;

  const customerId =
    searchParams.get("customer_id") ||
    searchParams.get("customerId") ||
    (session as any)?.customerId ||
    null;

  const orderId =
    searchParams.get("order_id") ||
    searchParams.get("orderId") ||
    searchParams.get("delivery_id") ||
    null;

  let sinceId = Number(searchParams.get("since_id") || searchParams.get("sinceId") || 0);
  const once = searchParams.get("once") === "true" || searchParams.get("mode") === "snapshot";

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const writeSse = async (eventName: string, data: any) => {
    try {
      await writer.write(
        encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    } catch {}
  };

  (async () => {
    await writeSse("connected", {
      status: "SUBSCRIBED",
      role,
      branch_id: branchId,
      customer_id: customerId,
      order_id: orderId,
      timestamp: new Date().toISOString(),
    });

    try {
      const initialEvents = await CrossAppEventService.getRecentEventsForSession({
        role,
        branchId,
        customerId,
        orderId,
        sinceId,
        limit: 25,
      });

      for (const evt of [...initialEvents].reverse()) {
        if (evt.id > sinceId) sinceId = evt.id;
        await writeSse(evt.event_type || "message", evt);
      }
    } catch (err: any) {
      await writeSse("error", { message: err?.message || "Initial stream query failed" });
    }

    if (once) {
      try {
        await writer.close();
      } catch {}
      return;
    }

    const interval = setInterval(async () => {
      try {
        await CrossAppEventService.processPendingOutboxEvents({ limit: 20 });
        const newEvents = await CrossAppEventService.getRecentEventsForSession({
          role,
          branchId,
          customerId,
          orderId,
          sinceId,
          limit: 20,
        });

        for (const evt of [...newEvents].reverse()) {
          if (evt.id > sinceId) sinceId = evt.id;
          await writeSse(evt.event_type || "message", evt);
        }
      } catch {}
    }, 2000);

    req.signal.addEventListener("abort", () => {
      clearInterval(interval);
      writer.close().catch(() => {});
    });
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
