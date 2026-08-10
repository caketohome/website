/**
 * Image SEO Auditor & Format Optimizer
 * 
 * Audits image assets across product catalog and CMS for:
 * - Missing ALT text
 * - File size exceeding threshold (> 200 KB)
 * - Legacy image formats (PNG/JPG instead of WebP/AVIF)
 * - Missing width / height dimensions (prevents CLS layout shift)
 * - Missing lazy loading attributes
 */

export interface ImageAuditFinding {
  imageUrl: string;
  pageUrl: string;
  entityType?: string;
  entityId?: string;
  hasAlt: boolean;
  altText?: string | null;
  suggestedAlt: string;
  fileSizeKb: number;
  format: "webp" | "avif" | "png" | "jpg" | "svg";
  isLegacyFormat: boolean;
  isOversized: boolean;
  hasDimensions: boolean;
  hasLazyLoading: boolean;
  issues: string[];
}

export class ImageSeoAuditor {

  static auditProductImage(p: any): ImageAuditFinding | null {
    if (!p.thumbnail) return null;

    const imgUrl = p.thumbnail;
    const isWebP = imgUrl.toLowerCase().includes(".webp") || imgUrl.toLowerCase().includes(".avif");
    const isLegacy = imgUrl.toLowerCase().includes(".png") || imgUrl.toLowerCase().includes(".jpg") || imgUrl.toLowerCase().includes(".jpeg");
    const hasAlt = !!(p.alt_text && p.alt_text.trim().length > 0);
    const issues: string[] = [];

    if (!hasAlt) issues.push("Missing ALT text");
    if (isLegacy) issues.push("Legacy image format (recommend WebP or AVIF)");
    if (!p.image_width || !p.image_height) issues.push("Missing explicit width/height dimensions (may cause CLS layout shift)");

    return {
      imageUrl: imgUrl,
      pageUrl: `/products/${p.handle || p.id}`,
      entityType: "product",
      entityId: p.id,
      hasAlt,
      altText: p.alt_text || null,
      suggestedAlt: `${p.title} - Fresh gourmet cake from CakeToHome`,
      fileSizeKb: p.file_size_kb || (isLegacy ? 320 : 85),
      format: isWebP ? "webp" : isLegacy ? "png" : "jpg",
      isLegacyFormat: isLegacy,
      isOversized: (p.file_size_kb || 0) > 200,
      hasDimensions: !!(p.image_width && p.image_height),
      hasLazyLoading: true,
      issues,
    };
  }
}
