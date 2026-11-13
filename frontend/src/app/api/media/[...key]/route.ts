import { NextRequest, NextResponse } from "next/server";
import { getMediaObject } from "@frontend/lib/media/media-storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/<folder>/<file> — serves public app media from the private S3 bucket
 * (key media/<folder>/<file>). File names are content-hashed, so responses are immutable.
 */
export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  const parts = params.key || [];
  const valid = parts.length === 2 && parts.every((p) => /^[A-Za-z0-9_.-]+$/.test(p) && !p.startsWith("."));
  if (!valid) return new NextResponse("Not found", { status: 404 });

  const obj = await getMediaObject(`media/${parts.join("/")}`, req.headers.get("if-none-match"));
  if (obj === "not-modified") return new NextResponse(null, { status: 304 });
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(obj.body, {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(obj.etag ? { ETag: obj.etag } : {}),
      ...(obj.length ? { "Content-Length": String(obj.length) } : {}),
    },
  });
}
