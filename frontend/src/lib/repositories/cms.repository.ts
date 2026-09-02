import { dbQuery } from "../db";
import { CmsPageDomain } from "../types/domain";

export class CmsRepository {
  /**
   * Find all CMS pages from PostgreSQL
   */
  static async findAllPages(): Promise<CmsPageDomain[]> {
    const res = await dbQuery(`SELECT * FROM "cms_page" ORDER BY created_at ASC`);
    return (res.rows || []).map((p: any) => {
      let blockParsed = { sections: [], draft_config: {}, published_config: null, version_history: [] };
      if (p.blocks) {
        try {
          blockParsed = typeof p.blocks === "string" ? JSON.parse(p.blocks) : p.blocks;
        } catch {}
      }
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        type: p.type || "landing",
        status: p.status || "draft",
        meta_title: p.meta_title || p.title,
        meta_description: p.meta_description || "",
        canonical_url: p.canonical_url || "",
        og_image: p.og_image || "",
        sections: blockParsed.sections || [],
        draft_config: blockParsed.draft_config || {},
        published_config: blockParsed.published_config || null,
        version_history: blockParsed.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      };
    });
  }

  /**
   * Find page by slug or id
   */
  static async findPageBySlug(slug: string): Promise<CmsPageDomain | null> {
    const res = await dbQuery(`SELECT * FROM "cms_page" WHERE slug = $1 OR id = $1 LIMIT 1`, [slug]);
    if (!res.rows || res.rows.length === 0) return null;
    const p = res.rows[0];
    let blockParsed = { sections: [], draft_config: {}, published_config: null, version_history: [] };
    if (p.blocks) {
      try {
        blockParsed = typeof p.blocks === "string" ? JSON.parse(p.blocks) : p.blocks;
      } catch {}
    }
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      type: p.type || "landing",
      status: p.status || "draft",
      meta_title: p.meta_title || p.title,
      meta_description: p.meta_description || "",
      canonical_url: p.canonical_url || "",
      og_image: p.og_image || "",
      sections: blockParsed.sections || [],
      draft_config: blockParsed.draft_config || {},
      published_config: blockParsed.published_config || null,
      version_history: blockParsed.version_history || [],
      created_at: p.created_at,
      updated_at: p.updated_at,
      published_at: p.published_at,
    };
  }

  /**
   * Upsert CMS page directly into PostgreSQL
   */
  static async savePage(page: Partial<CmsPageDomain>): Promise<void> {
    const id = page.id || `page_${Date.now()}`;
    const slug = page.slug || id;
    const title = page.title || "Untitled Page";
    const status = page.status || "draft";
    const blocks = {
      sections: page.sections || [],
      draft_config: page.draft_config || {},
      published_config: page.published_config || null,
      version_history: page.version_history || [],
    };

    await dbQuery(
      `
      INSERT INTO "cms_page" (id, slug, title, type, status, meta_title, meta_description, canonical_url, og_image, blocks, created_at, updated_at, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description,
        canonical_url = EXCLUDED.canonical_url,
        og_image = EXCLUDED.og_image,
        blocks = EXCLUDED.blocks,
        updated_at = NOW(),
        published_at = EXCLUDED.published_at
    `,
      [
        id,
        slug,
        title,
        page.type || "landing",
        status,
        page.meta_title || title,
        page.meta_description || "",
        page.canonical_url || "",
        page.og_image || "",
        JSON.stringify(blocks),
        status === "published" ? new Date() : (page.published_at ? new Date(page.published_at) : null),
      ]
    );
  }

  /**
   * Delete CMS page in PostgreSQL
   */
  static async deletePage(id: string): Promise<void> {
    await dbQuery(`DELETE FROM "cms_page" WHERE id = $1`, [id]);
  }
}
