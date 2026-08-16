import { NextRequest, NextResponse } from "next/server";
import { KnowledgeSyncService } from "@frontend/lib/ai/knowledge-sync-service";

export async function POST(req: NextRequest) {
  try {
    const res = await KnowledgeSyncService.syncAll();
    return NextResponse.json({
      success: res.success,
      documentsIndexed: res.documentsIndexed,
      errors: res.errors,
      message: `Synchronized ${res.documentsIndexed} knowledge documents from live database.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
