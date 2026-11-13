/**
 * Media object storage. AWS S3 when AWS_S3_BUCKET_NAME is set (server-only env);
 * otherwise local public/uploads for offline development only.
 *
 * The bucket stays private: files are served by /api/media/<folder>/<file> using the app's
 * own key. Set MEDIA_PUBLIC_BASE_URL (e.g. a CloudFront URL mapped to media/) to serve
 * directly from a CDN instead.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

let client: S3Client | null = null;

function s3(): { client: S3Client; bucket: string } | null {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) return null;
  client ??= new S3Client({ region: process.env.AWS_REGION || "ap-south-1" }); // creds: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  return { client, bucket };
}

export function isS3Enabled(): boolean {
  return Boolean(process.env.AWS_S3_BUCKET_NAME);
}

/** Stores `body` under media/<folder>/<fileName> and returns the URL the site should use. */
export async function putMediaObject(folder: string, fileName: string, body: Buffer, contentType: string): Promise<string> {
  const safeFolder = (folder || "uploads").replace(/[^a-zA-Z0-9_-]/g, "_");
  const target = s3();

  if (target) {
    await target.client.send(
      new PutObjectCommand({
        Bucket: target.bucket,
        Key: `media/${safeFolder}/${fileName}`,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable", // file names are content-hashed
      })
    );
    const base = (process.env.MEDIA_PUBLIC_BASE_URL || "/api/media").replace(/\/+$/, "");
    return `${base}/${safeFolder}/${fileName}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Media storage not configured: set AWS_S3_BUCKET_NAME, AWS_REGION and AWS credentials.");
  }
  let root = process.cwd();
  if (!root.endsWith("frontend") && fs.existsSync(path.join(root, "frontend"))) root = path.join(root, "frontend");
  const dir = path.join(root, "public", "uploads", safeFolder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), body);
  return `/uploads/${safeFolder}/${fileName}`;
}

/** Reads a media object for /api/media. Only image content types are passed through. */
export async function getMediaObject(
  key: string,
  ifNoneMatch?: string | null
): Promise<{ body: ReadableStream; contentType: string; etag?: string; length?: number } | "not-modified" | null> {
  const target = s3();
  if (!target || !key.startsWith("media/")) return null;
  try {
    const res = await target.client.send(
      new GetObjectCommand({ Bucket: target.bucket, Key: key, IfNoneMatch: ifNoneMatch || undefined })
    );
    if (!res.Body) return null;
    const type = res.ContentType || "";
    return {
      body: res.Body.transformToWebStream(),
      contentType: type.startsWith("image/") && !type.includes("svg") ? type : "application/octet-stream",
      etag: res.ETag,
      length: res.ContentLength,
    };
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 304) return "not-modified";
    if (status === 404 || err?.name === "NoSuchKey") return null;
    console.error("[media-storage] S3 read failed:", err?.name || status);
    return null;
  }
}
