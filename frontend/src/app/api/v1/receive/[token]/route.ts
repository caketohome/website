import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { describeHandoff, confirmHandoff } from "@frontend/lib/services/delivery-handoff.service";

export const dynamic = "force-dynamic";

/** GET — what the receiver sees after scanning (no code, no personal details). */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await describeHandoff(params.token);
  if (r.status !== 200) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  const session = resolveServerSession(req);
  return NextResponse.json({ success: true, signed_in: Boolean(session?.phone), ...r.data }, { headers: { "Cache-Control": "no-store" } });
}

/** POST { received_safely, problem? } — signed-in receiver confirms; gets the delivery code only if safe. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = resolveServerSession(req);
  if (!session?.phone) return NextResponse.json({ success: false, error: "Sign in with your mobile number first." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const r = await confirmHandoff(params.token, session.phone, b.received_safely === true, b.problem);
  if (r.status !== 200) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, ...r.data }, { headers: { "Cache-Control": "no-store" } });
}
