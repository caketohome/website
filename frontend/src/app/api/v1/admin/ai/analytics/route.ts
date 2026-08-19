import { NextRequest, NextResponse } from "next/server";
import { AiAnalyticsService } from "@frontend/lib/ai/ai-analytics-service";
import { KnowledgeSyncService } from "@frontend/lib/ai/knowledge-sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const summary = AiAnalyticsService.getAnalyticsSummary();
    const unanswered = AiAnalyticsService.getUnansweredQueries();
    const syncStatus = KnowledgeSyncService.getSyncStatus();

    return NextResponse.json({
      success: true,
      summary,
      unanswered,
      syncStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
