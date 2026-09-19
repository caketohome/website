/**
 * CakeToHome — Media Repository
 * PostgreSQL repository for the media table.
 * All media items are persisted directly in PostgreSQL.
 */

import { dbQuery } from "@frontend/lib/db";

export interface MediaRecord {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string;
  mime_type: string;
  size: number;
  folder: string;
  alt_text: string | null;
  width: number;
  height: number;
  is_webp_generated: boolean;
  is_avif_generated: boolean;
  responsive_variants: any | null;
  blur_placeholder: string | null;
  content_hash: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface MediaCreateInput {
  name: string;
  url: string;
  thumbnail_url?: string;
  mime_type?: string;
  size?: number;
  folder?: string;
  alt_text?: string;
  width?: number;
  height?: number;
  is_webp_generated?: boolean;
  is_avif_generated?: boolean;
  responsive_variants?: any;
  blur_placeholder?: string;
  content_hash?: string;
  metadata?: any;
}

export class MediaRepository {
  /**
   * List media records with optional folder, search, and pagination filters.
   */
  static async listMedia(filters?: {
    folder?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ media: MediaRecord[]; total: number }> {
    let query = `SELECT * FROM media WHERE deleted_at IS NULL`;
    let countQuery = `SELECT COUNT(*) FROM media WHERE deleted_at IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.folder && filters.folder !== "all") {
      query += ` AND folder = $${paramIndex}`;
      countQuery += ` AND folder = $${paramIndex}`;
      params.push(filters.folder);
      paramIndex++;
    }

    if (filters?.search) {
      query += ` AND (name ILIKE $${paramIndex} OR alt_text ILIKE $${paramIndex} OR url ILIKE $${paramIndex})`;
      countQuery += ` AND (name ILIKE $${paramIndex} OR alt_text ILIKE $${paramIndex} OR url ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const [rowsRes, countRes] = await Promise.all([
      dbQuery(query, params),
      dbQuery(countQuery, params.slice(0, paramIndex - 1)),
    ]);

    const total = parseInt(countRes.rows[0]?.count || "0");
    const media = rowsRes.rows.map((r: any) => ({
      ...r,
      size: Number(r.size) || 0,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
      responsive_variants: r.responsive_variants ? (typeof r.responsive_variants === "string" ? JSON.parse(r.responsive_variants) : r.responsive_variants) : null,
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
    }));

    return { media, total };
  }

  /**
   * Get single media record by ID.
   */
  static async getMediaById(id: string): Promise<MediaRecord | null> {
    const res = await dbQuery(`SELECT * FROM media WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      size: Number(r.size) || 0,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
      responsive_variants: r.responsive_variants ? (typeof r.responsive_variants === "string" ? JSON.parse(r.responsive_variants) : r.responsive_variants) : null,
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
    };
  }

  /**
   * Create a new media record in PostgreSQL.
   */
  static async createMedia(data: MediaCreateInput): Promise<MediaRecord> {
    const id = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const variantsStr = data.responsive_variants ? JSON.stringify(data.responsive_variants) : null;
    const metaStr = data.metadata ? JSON.stringify(data.metadata) : null;

    const res = await dbQuery(
      `INSERT INTO media (
        id, name, url, thumbnail_url, mime_type, size, folder, alt_text,
        width, height, is_webp_generated, is_avif_generated,
        responsive_variants, blur_placeholder, content_hash, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        NOW(), NOW()
      ) RETURNING *`,
      [
        id,
        data.name,
        data.url,
        data.thumbnail_url || data.url,
        data.mime_type || "image/jpeg",
        data.size || 0,
        data.folder || "uploads",
        data.alt_text || null,
        data.width || 0,
        data.height || 0,
        data.is_webp_generated || false,
        data.is_avif_generated || false,
        variantsStr,
        data.blur_placeholder || null,
        data.content_hash || null,
        metaStr,
      ]
    );

    const r = res.rows[0];
    return {
      ...r,
      size: Number(r.size) || 0,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
      responsive_variants: data.responsive_variants || null,
      metadata: data.metadata || null,
    };
  }

  /**
   * Update existing media record.
   */
  static async updateMedia(
    id: string,
    data: Partial<{
      name: string;
      alt_text: string;
      folder: string;
      metadata: any;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.name); }
    if (data.alt_text !== undefined) { fields.push(`alt_text = $${paramIndex++}`); values.push(data.alt_text); }
    if (data.folder !== undefined) { fields.push(`folder = $${paramIndex++}`); values.push(data.folder); }
    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(typeof data.metadata === "string" ? data.metadata : JSON.stringify(data.metadata));
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await dbQuery(`UPDATE media SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL`, values);
    return true;
  }

  /**
   * Soft-delete a media record.
   */
  static async deleteMedia(id: string): Promise<boolean> {
    await dbQuery(`UPDATE media SET deleted_at = NOW() WHERE id = $1`, [id]);
    return true;
  }

  /**
   * Get aggregate media statistics from PostgreSQL.
   */
  static async getMediaStats(): Promise<{
    total_count: number;
    total_size_bytes: number;
    webp_count: number;
    avif_count: number;
    folders: Array<{ folder: string; count: number }>;
  }> {
    const [summary, foldersRes] = await Promise.all([
      dbQuery(`
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(size), 0) AS total_size,
          COUNT(CASE WHEN is_webp_generated = true THEN 1 END) AS webp_count,
          COUNT(CASE WHEN is_avif_generated = true THEN 1 END) AS avif_count
        FROM media
        WHERE deleted_at IS NULL
      `),
      dbQuery(`
        SELECT COALESCE(folder, 'general') AS folder, COUNT(*) AS count
        FROM media
        WHERE deleted_at IS NULL
        GROUP BY folder
        ORDER BY count DESC
      `),
    ]);

    return {
      total_count: parseInt(summary.rows[0]?.total_count || "0"),
      total_size_bytes: parseInt(summary.rows[0]?.total_size || "0"),
      webp_count: parseInt(summary.rows[0]?.webp_count || "0"),
      avif_count: parseInt(summary.rows[0]?.avif_count || "0"),
      folders: foldersRes.rows.map((r: any) => ({ folder: r.folder, count: parseInt(r.count) })),
    };
  }
}
