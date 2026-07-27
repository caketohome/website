import { model } from "@medusajs/utils";

/**
 * Media library entry. Used by CMS, products, banners, blog, reviews (UGC).
 * Supports CDN-backed storage with automatic WebP/AVIF generation, compression,
 * responsive variants, blur placeholders, folder hierarchy, and duplicate detection.
 */
export const Media = model.define("media", {
    id: model
        .id({
            prefix: "med",
        })
        .primaryKey(),
    name: model.text(),
    url: model.text(),
    thumbnail_url: model.text().nullable(),
    mime_type: model.text(),
    size: model.number().default(0),
    folder: model.text().default("root"),
    // Folder hierarchy: parent folder id (null = root).
    parent_id: model.text().nullable(),
    alt_text: model.text().nullable(),
    width: model.number().nullable(),
    height: model.number().nullable(),
    is_webp_generated: model.boolean().default(false),
    // AVIF generation flag (next-gen format).
    is_avif_generated: model.boolean().default(false),
    // Responsive variant URLs (JSON: { "320": "url", "640": "url", "1024": "url", "1920": "url" }).
    responsive_variants: model.text().nullable(),
    // Tiny base64 blur placeholder (LQIP) for progressive image loading.
    blur_placeholder: model.text().nullable(),
    // SHA-256 hash of file content for duplicate detection.
    content_hash: model.text().searchable().nullable(),
    // Extracted EXIF/metadata (JSON).
    metadata: model.text().nullable(),
});
