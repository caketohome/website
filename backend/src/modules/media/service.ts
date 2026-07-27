import { MedusaService } from "@medusajs/utils";
import { Media } from "./models";
import type { CreateMediaDTO } from "./types/common";

function stringifyJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

/**
 * Media / File Manager module service.
 * Stores media metadata, supports folder hierarchy, responsive variants,
 * blur placeholders, AVIF/WebP generation tracking, and duplicate detection.
 * Actual file storage + conversion is handled by a storage adapter
 * (local/S3/CDN) wired in the upload API route.
 */
class MediaModuleService extends MedusaService({
    Media,
}) {
    /**
     * Register a media entry after upload.
     */
    async registerMedia(input: CreateMediaDTO) {
        return this.createMedia({
            name: input.name,
            url: input.url,
            thumbnail_url: input.thumbnail_url ?? null,
            mime_type: input.mime_type,
            size: input.size ?? 0,
            folder: input.folder ?? "root",
            alt_text: input.alt_text ?? null,
            width: input.width ?? null,
            height: input.height ?? null,
            is_webp_generated: input.is_webp_generated ?? false,
        });
    }

    /**
     * Bulk-register multiple media entries (bulk upload).
     */
    async registerMediaBulk(inputs: CreateMediaDTO[]) {
        const records = inputs.map((input) => ({
            name: input.name,
            url: input.url,
            thumbnail_url: input.thumbnail_url ?? null,
            mime_type: input.mime_type,
            size: input.size ?? 0,
            folder: input.folder ?? "root",
            alt_text: input.alt_text ?? null,
            width: input.width ?? null,
            height: input.height ?? null,
            is_webp_generated: input.is_webp_generated ?? false,
        }));
        return this.createMedia(records);
    }

    /**
     * List media by folder.
     */
    async listByFolder(folder: string) {
        return this.listMedia({ folder });
    }

    /**
     * List media by parent folder id (folder hierarchy).
     */
    async listByParent(parentId: string | null) {
        if (parentId === null) {
            // Root-level items: parent_id is null.
            const all = (await this.listMedia({})) as unknown as Record<string, unknown>[];
            return all.filter((m) => m.parent_id === null || m.parent_id === undefined);
        }
        return this.listMedia({ parent_id: parentId } as never);
    }

    /**
     * Mark WebP generation complete and store the WebP URL.
     */
    async markWebpGenerated(id: string, webpUrl: string) {
        return this.updateMedia({
            selector: { id },
            data: { is_webp_generated: true, thumbnail_url: webpUrl },
        });
    }

    /**
     * Mark AVIF generation complete.
     */
    async markAvifGenerated(id: string) {
        return this.updateMedia({
            selector: { id },
            data: { is_avif_generated: true },
        });
    }

    /**
     * Store responsive variant URLs for an image.
     * variants: { "320": "url", "640": "url", "1024": "url", "1920": "url" }
     */
    async setResponsiveVariants(id: string, variants: Record<string, string>) {
        return this.updateMedia({
            selector: { id },
            data: { responsive_variants: stringifyJson(variants) },
        });
    }

    /**
     * Store a tiny base64 blur placeholder (LQIP) for progressive loading.
     */
    async setBlurPlaceholder(id: string, placeholder: string) {
        return this.updateMedia({
            selector: { id },
            data: { blur_placeholder: placeholder },
        });
    }

    /**
     * Store extracted EXIF/metadata.
     */
    async setMetadata(id: string, metadata: Record<string, unknown>) {
        return this.updateMedia({
            selector: { id },
            data: { metadata: stringifyJson(metadata) },
        });
    }

    /**
     * Set the content hash (for duplicate detection).
     */
    async setContentHash(id: string, hash: string) {
        return this.updateMedia({
            selector: { id },
            data: { content_hash: hash },
        });
    }

    /**
     * Find a duplicate by content hash. Returns the existing media or null.
     */
    async findDuplicate(contentHash: string) {
        const existing = (await this.listMedia({
            content_hash: contentHash,
        } as never)) as unknown as Record<string, unknown>[];
        return existing.length > 0 ? existing[0] : null;
    }

    /**
     * Move media to a different folder.
     */
    async moveToFolder(id: string, folder: string, parentId?: string | null) {
        return this.updateMedia({
            selector: { id },
            data: { folder, parent_id: parentId ?? null },
        });
    }
}

export default MediaModuleService;
