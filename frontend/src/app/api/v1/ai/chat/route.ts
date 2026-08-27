import { NextRequest, NextResponse } from "next/server";
import { AiOrchestrator } from "@frontend/lib/ai/ai-orchestrator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, context } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const sid = sessionId || `anon_${Date.now()}`;
    const response = await AiOrchestrator.processMessage(message, sid, context);

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (err: any) {
    console.error("AI Chat route error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "AI Concierge service is temporarily unavailable. You can continue shopping normally.",
        fallback: true,
      },
      { status: 500 }
    );
  }
}
