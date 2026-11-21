import { NextRequest, NextResponse } from "next/server";
import { MetaCapiService } from "@/lib/services/meta-capi.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/integrations/meta/capi
 * Dispatches a server-side conversion event to Meta Conversions API
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_name, event_id, user_data, custom_data, event_source_url } = body;

    if (!event_name || !event_id) {
      return NextResponse.json(
        { success: false, error: "MISSING_REQUIRED_FIELDS", message: "event_name and event_id are required." },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await MetaCapiService.sendEvent({
      eventName: event_name,
      eventId: event_id,
      eventSourceUrl: event_source_url || "https://caketohome.com/",
      userData: {
        ...user_data,
        clientIp: user_data?.clientIp || clientIp,
        userAgent: user_data?.userAgent || userAgent,
      },
      customData: custom_data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[MetaCapiRoute Error]:", err.message);
    return NextResponse.json(
      { success: false, error: "CAPI_DISPATCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}

