/**
 * CakeToHome — Media Processing Pipeline
 * Hardware-accelerated image processor using Sharp.
 * Handles WebP/AVIF transcoding, responsive resizing, blur placeholder generation,
 * and security sanitization.
 */

import sharp from "sharp";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export interface ProcessedImageResult {
  filename: string;
  width: number;
  height: number;
  size: number;
  mime_type: string;
  url: string;
  thumbnail_url: string;
  blur_placeholder: string;
  is_webp_generated: boolean;
  is_avif_generated: boolean;
  responsive_variants: {
    thumbnail?: { url: string; width: number; height: number; size: number };
    medium?: { url: string; width: number; height: number; size: number };
    large?: { url: string; width: number; height: number; size: number };
    webp?: { url: string; size: number };
    avif?: { url: string; size: number };
  };
  content_hash: string;
}

export class MediaProcessor {
  private static getUploadsDir(): string {
    let root = process.cwd();
    if (!root.endsWith("frontend") && fs.existsSync(path.join(root, "frontend"))) {
      root = path.join(root, "frontend");
    }
    const uploadsDir = path.join(root, "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    return uploadsDir;
  }

  /**
   * Process an image buffer: optimize, generate WebP, AVIF, responsive sizes, and blur placeholder.
   */
  static async processBuffer(
    buffer: Buffer,
    originalFilename: string,
    options?: { folder?: string; alt?: string }
  ): Promise<ProcessedImageResult> {
    const uploadsDir = this.getUploadsDir();

    // Compute content hash
    const content_hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const ext = path.extname(originalFilename).toLowerCase().replace(".", "") || "jpg";
    const baseName = path.basename(originalFilename, path.extname(originalFilename)).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueId = `${Date.now()}_${content_hash.slice(0, 8)}`;

    // Inspect metadata with Sharp
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width || 1200;
    const originalHeight = metadata.height || 800;

    // 1. Generate base64 blur placeholder (24px width)
    let blur_placeholder = "";
    try {
      const placeholderBuf = await sharp(buffer)
        .resize(24, Math.round(24 * (originalHeight / originalWidth)), { fit: "inside" })
        .blur(2)
        .toFormat("webp", { quality: 20 })
        .toBuffer();
      blur_placeholder = `data:image/webp;base64,${placeholderBuf.toString("base64")}`;
    } catch (e) {
      console.warn("[MediaProcessor] Failed to generate blur placeholder:", e);
    }

    // 2. Save optimized original (strip EXIF metadata for privacy)
    const mainFileName = `${baseName}_${uniqueId}.${ext}`;
    const mainFilePath = path.join(uploadsDir, mainFileName);
    const mainBuffer = await sharp(buffer).rotate().toBuffer();
    fs.writeFileSync(mainFilePath, mainBuffer);
    const mainUrl = `/uploads/${mainFileName}`;

    // 3. Generate WebP variant
    let is_webp_generated = false;
    let webpVariant: { url: string; size: number } | undefined;
    try {
      const webpFileName = `${baseName}_${uniqueId}.webp`;
      const webpFilePath = path.join(uploadsDir, webpFileName);
      const webpBuffer = await sharp(buffer).rotate().webp({ quality: 85, effort: 4 }).toBuffer();
      fs.writeFileSync(webpFilePath, webpBuffer);
      is_webp_generated = true;
      webpVariant = { url: `/uploads/${webpFileName}`, size: webpBuffer.length };
    } catch (e) {
      console.warn("[MediaProcessor] Failed to generate WebP:", e);
    }

    // 4. Generate AVIF variant
    let is_avif_generated = false;
    let avifVariant: { url: string; size: number } | undefined;
    try {
      const avifFileName = `${baseName}_${uniqueId}.avif`;
      const avifFilePath = path.join(uploadsDir, avifFileName);
      const avifBuffer = await sharp(buffer).rotate().avif({ quality: 75, effort: 4 }).toBuffer();
      fs.writeFileSync(avifFilePath, avifBuffer);
      is_avif_generated = true;
      avifVariant = { url: `/uploads/${avifFileName}`, size: avifBuffer.length };
    } catch (e) {
      console.warn("[MediaProcessor] Failed to generate AVIF:", e);
    }

    // 5. Generate Thumbnail (300px)
    let thumbnail_url = mainUrl;
    let thumbVariant: { url: string; width: number; height: number; size: number } | undefined;
    try {
      const thumbFileName = `${baseName}_${uniqueId}_thumb.webp`;
      const thumbFilePath = path.join(uploadsDir, thumbFileName);
      const thumbBuffer = await sharp(buffer)
        .rotate()
        .resize(300, 300, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toBuffer();
      fs.writeFileSync(thumbFilePath, thumbBuffer);
      thumbnail_url = `/uploads/${thumbFileName}`;
      thumbVariant = { url: thumbnail_url, width: 300, height: 300, size: thumbBuffer.length };
    } catch (e) {
      console.warn("[MediaProcessor] Failed to generate thumbnail:", e);
    }

    // 6. Generate Medium (600px)
    let mediumVariant: { url: string; width: number; height: number; size: number } | undefined;
    if (originalWidth > 600) {
      try {
        const medFileName = `${baseName}_${uniqueId}_med.webp`;
        const medFilePath = path.join(uploadsDir, medFileName);
        const medBuffer = await sharp(buffer)
          .rotate()
          .resize(600, Math.round(600 * (originalHeight / originalWidth)), { fit: "inside" })
          .webp({ quality: 85 })
          .toBuffer();
        fs.writeFileSync(medFilePath, medBuffer);
        mediumVariant = { url: `/uploads/${medFileName}`, width: 600, height: Math.round(600 * (originalHeight / originalWidth)), size: medBuffer.length };
      } catch (e) {
        console.warn("[MediaProcessor] Failed to generate medium variant:", e);
      }
    }

    return {
      filename: mainFileName,
      width: originalWidth,
      height: originalHeight,
      size: mainBuffer.length,
      mime_type: `image/${ext === "jpg" ? "jpeg" : ext}`,
      url: mainUrl,
      thumbnail_url,
      blur_placeholder,
      is_webp_generated,
      is_avif_generated,
      responsive_variants: {
        thumbnail: thumbVariant,
        medium: mediumVariant,
        webp: webpVariant,
        avif: avifVariant,
      },
      content_hash,
    };
  }
}
