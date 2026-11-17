/**
 * CakeToHome — SEO Repository
 * PostgreSQL repository for SEO configuration, pages, redirects, and dashboard aggregates.
 * All data is persisted directly in PostgreSQL (setting, cms_page, cms_redirect, product).
 */

import { dbQuery } from "@frontend/lib/db";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export interface GlobalSeoConfig {
  meta_title: string;
  meta_description: string;
  keywords: string;
  canonical_url: string;
  og_image: string;
  ga_id: string;
  fb_pixel_id: string;
  gtm_id: string;
  robots_txt: string;
  schema_type: string;
}

export interface SeoPageMeta {
  id: string;
  page_id?: string;
  route: string;
  url: string;
  title: string;
  entity_type: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  og_image: string;
  og_title?: string;
  og_description?: string;
  robots_directive?: string;
  schema_json?: string;
  h1?: string;
  h1_text?: string;
  focus_keyword?: string;
  seo_score: number;
  has_schema: boolean;
  status: string;
  last_crawled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SeoRedirect {
  id: string;
  from_path: string;
  to_url: string;
  source_url: string; // compatibility alias
  target_url: string; // compatibility alias
  redirect_type: number; // 301, 302, 307, 308
  status_code: number;   // compatibility alias
  is_active: boolean;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

export interface SeoDashboardSummary {
  total_pages: number;
  indexed_pages: number;
  non_indexed_pages: number;
  seo_score: number;
  geo_score: number;
  aeo_score: number;
  broken_links: number;
  missing_alt: number;
  duplicate_titles: number;
  duplicate_descriptions: number;
  missing_schema: number;
  missing_canonical: number;
  missing_h1: number;
  multiple_h1: number;
  tracked_keywords: number;
  total_redirects: number;
  active_redirects: number;
  geo_pages: number;
  aeo_entries: number;
  competitors: number;
  utm_campaigns: number;
  backlinks: number;
  core_web_vitals: {
    lcp_ms: number;
    cls: number;
    inp_ms: number;
  };
  sitemap_health: {
    valid: boolean;
    entry_count: number;
  };
  robots_health: {
    valid: boolean;
  };
  last_crawl: string;
}

const DEFAULT_SEO_CONFIG: GlobalSeoConfig = {
  meta_title: "CakeToHome — Fresh Handcrafted Cakes Delivered Same Day",
  meta_description: "Order fresh handcrafted cakes online for birthdays, anniversaries, and celebrations with same-day 2-hour delivery across Bangalore.",
  keywords: "cake delivery, online cake order, birthday cakes, anniversary cakes, chocolate truffle, customized cakes bangalore",
  canonical_url: "https://caketohome.com",
  og_image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
  ga_id: "",
  fb_pixel_id: "",
  gtm_id: "",
  robots_txt: "User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /checkout\nDisallow: /cart\nDisallow: /dashboard\nDisallow: /admin\nSitemap: https://caketohome.com/sitemap.xml",
  schema_type: "Bakery",
};

/* ─────────────────────────────────────────────────────────────────────────────
 * SEO Repository Implementation
 * ────────────────────────────────────────────────────────────────────────── */

export class SeoRepository {

  /* ── Global SEO Config (stored in setting table) ── */

  static async getGlobalSeoConfig(): Promise<GlobalSeoConfig> {
    try {
      const result = await dbQuery(
        `SELECT value FROM setting WHERE "group" = 'seo' AND key = 'global_config' AND deleted_at IS NULL LIMIT 1`
      );
      if (result.rows.length > 0 && result.rows[0].value) {
        const parsed = JSON.parse(result.rows[0].value);
        return { ...DEFAULT_SEO_CONFIG, ...parsed };
      }
    } catch (err) {
      console.warn("[SeoRepository.getGlobalSeoConfig] Falling back to defaults:", err);
    }
    return DEFAULT_SEO_CONFIG;
  }

  static async updateGlobalSeoConfig(data: Partial<GlobalSeoConfig>): Promise<GlobalSeoConfig> {
    const current = await this.getGlobalSeoConfig();
    const updated = { ...current, ...data };
    const serialized = JSON.stringify(updated);

    await dbQuery(
      `INSERT INTO setting (id, "group", key, value, is_json, is_secret, description, created_at, updated_at)
       VALUES ('set_seo_global_config', 'seo', 'global_config', $1, true, false, 'Global SEO and Analytics Configuration', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
       SET value = $1, updated_at = NOW()`,
      [serialized]
    );

    return updated;
  }

  /* ── Generic Setting Access ── */

  static async getSetting<T = any>(key: string): Promise<T | null> {
    try {
      const res = await dbQuery(
        `SELECT value, is_json FROM setting WHERE "group" = 'seo' AND key = $1 AND deleted_at IS NULL LIMIT 1`,
        [key]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      if (row.is_json && row.value) {
        try {
          return JSON.parse(row.value);
        } catch {
          return row.value;
        }
      }
      return row.value;
    } catch (err) {
      console.warn(`[SeoRepository.getSetting] Error reading ${key}:`, err);
      return null;
    }
  }

  static async saveSetting(key: string, value: any, description: string = "SEO Configuration"): Promise<void> {
    const isJson = typeof value === "object" && value !== null;
    const serialized = isJson ? JSON.stringify(value) : String(value);
    const id = `set_seo_${key.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    await dbQuery(
      `INSERT INTO setting (id, "group", key, value, is_json, is_secret, description, created_at, updated_at)
       VALUES ($1, 'seo', $2, $3, $4, false, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
       SET value = $3, is_json = $4, updated_at = NOW()`,
      [id, key, serialized, isJson, description]
    );
  }

  /* ── Page SEO Meta ── */

  static async listPageSeoMeta(filters?: { entity_type?: string; search?: string }): Promise<SeoPageMeta[]> {
    let query = `
      SELECT id, slug, title, type, status, meta_title, meta_description,
             canonical_url, og_image, created_at, updated_at
      FROM cms_page
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.search) {
      query += ` AND (title ILIKE $${paramIndex} OR slug ILIKE $${paramIndex} OR meta_title ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await dbQuery(query, params);
    return result.rows.map((r: any) => {
      const route = `/${r.slug}`;
      const hasMeta = !!(r.meta_title && r.meta_title.trim().length > 0);
      const hasDesc = !!(r.meta_description && r.meta_description.trim().length > 0);
      let score = 50;
      if (hasMeta) score += 25;
      if (hasDesc) score += 15;
      if (r.canonical_url) score += 10;

      return {
        id: r.id,
        route,
        url: route,
        title: r.title || r.slug,
        entity_type: r.type || "page",
        meta_title: r.meta_title || r.title || "",
        meta_description: r.meta_description || "",
        canonical_url: r.canonical_url || "",
        og_image: r.og_image || "",
        seo_score: Math.min(100, score),
        has_schema: true,
        status: r.status || "published",
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });
  }

  static async updatePageSeo(
    pageId: string,
    data: {
      meta_title?: string;
      meta_description?: string;
      canonical_url?: string;
      og_image?: string;
    }
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.meta_title !== undefined) {
      fields.push(`meta_title = $${paramIndex++}`);
      values.push(data.meta_title);
    }
    if (data.meta_description !== undefined) {
      fields.push(`meta_description = $${paramIndex++}`);
      values.push(data.meta_description);
    }
    if (data.canonical_url !== undefined) {
      fields.push(`canonical_url = $${paramIndex++}`);
      values.push(data.canonical_url);
    }
    if (data.og_image !== undefined) {
      fields.push(`og_image = $${paramIndex++}`);
      values.push(data.og_image);
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(pageId);

    await dbQuery(
      `UPDATE cms_page SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );
    return true;
  }

  /* ── Redirects ── */

  static async listRedirects(filters?: {
    is_active?: boolean;
    search?: string;
  }): Promise<SeoRedirect[]> {
    let query = `SELECT * FROM cms_redirect WHERE deleted_at IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.is_active);
    }
    if (filters?.search) {
      query += ` AND (from_path ILIKE $${paramIndex} OR to_url ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await dbQuery(query, params);
    return result.rows.map((r: any) => ({
      id: r.id,
      from_path: r.from_path,
      to_url: r.to_url,
      source_url: r.from_path,
      target_url: r.to_url,
      redirect_type: r.redirect_type || 301,
      status_code: r.redirect_type || 301,
      is_active: r.is_active,
      hit_count: 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  static async createRedirect(data: {
    from_path?: string;
    source_url?: string;
    to_url?: string;
    target_url?: string;
    redirect_type?: number;
    status_code?: number;
    is_active?: boolean;
  }): Promise<SeoRedirect> {
    const from = (data.from_path || data.source_url || "").trim();
    const to = (data.to_url || data.target_url || "").trim();
    const code = data.redirect_type || data.status_code || 301;
    const active = data.is_active !== false;

    if (!from || !to) {
      throw new Error("Source and target URLs are required for a redirect.");
    }
    if (from === to) {
      throw new Error(`Self-redirect loop detected: ${from} → ${to}`);
    }

    const id = `redir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await dbQuery(
      `INSERT INTO cms_redirect (id, from_path, to_url, redirect_type, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, from, to, code, active]
    );

    const r = result.rows[0];
    return {
      id: r.id,
      from_path: r.from_path,
      to_url: r.to_url,
      source_url: r.from_path,
      target_url: r.to_url,
      redirect_type: r.redirect_type,
      status_code: r.redirect_type,
      is_active: r.is_active,
      hit_count: 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  static async updateRedirect(
    id: string,
    data: Partial<{
      from_path: string;
      source_url: string;
      to_url: string;
      target_url: string;
      redirect_type: number;
      status_code: number;
      is_active: boolean;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const from = data.from_path || data.source_url;
    if (from !== undefined) {
      fields.push(`from_path = $${paramIndex++}`);
      values.push(from);
    }

    const to = data.to_url || data.target_url;
    if (to !== undefined) {
      fields.push(`to_url = $${paramIndex++}`);
      values.push(to);
    }

    const code = data.redirect_type || data.status_code;
    if (code !== undefined) {
      fields.push(`redirect_type = $${paramIndex++}`);
      values.push(code);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await dbQuery(
      `UPDATE cms_redirect SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );
    return true;
  }

  static async deleteRedirect(id: string): Promise<boolean> {
    await dbQuery(`UPDATE cms_redirect SET deleted_at = NOW() WHERE id = $1`, [id]);
    return true;
  }

  /* ── SEO Dashboard Aggregates ── */

  static async getDashboardSummary(): Promise<SeoDashboardSummary> {
    const [pages, redirects, products] = await Promise.all([
      dbQuery(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN meta_title IS NOT NULL AND meta_title != '' THEN 1 END) AS with_meta,
          COUNT(CASE WHEN meta_title IS NULL OR meta_title = '' THEN 1 END) AS without_meta,
          COUNT(CASE WHEN canonical_url IS NOT NULL AND canonical_url != '' THEN 1 END) AS with_canonical
        FROM cms_page WHERE deleted_at IS NULL
      `),
      dbQuery(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN is_active = true THEN 1 END) AS active
        FROM cms_redirect WHERE deleted_at IS NULL
      `),
      dbQuery(`
        SELECT COUNT(*) AS total FROM product WHERE deleted_at IS NULL
      `),
    ]);

    const totalPages = parseInt(pages.rows[0]?.total || "0");
    const withMeta = parseInt(pages.rows[0]?.with_meta || "0");
    const withoutMeta = parseInt(pages.rows[0]?.without_meta || "0");
    const withCanonical = parseInt(pages.rows[0]?.with_canonical || "0");
    const totalRedirs = parseInt(redirects.rows[0]?.total || "0");
    const activeRedirs = parseInt(redirects.rows[0]?.active || "0");
    const totalProds = parseInt(products.rows[0]?.total || "0");

    const totalIndexed = withMeta;
    const avgScore = totalPages > 0 ? Math.round((withMeta / totalPages) * 85) + 15 : 85;

    // GEO / AEO from real data instead of fixed numbers.
    const { ApiEngine } = await import("../api-engine");
    const { LocalSeoRepository } = await import("./local-seo.repository");
    const localPages = await LocalSeoRepository.listAllLocalPages().catch(() => []);
    const aeoEntries = (() => { try { return ApiEngine.getSeoAeoEntries() || []; } catch { return []; } })();
    const keywords = (() => { try { return ApiEngine.getSeoKeywords() || []; } catch { return []; } })();
    const geoScore = localPages.length > 0
      ? Math.round(localPages.reduce((a: number, p: any) => a + (p.geo_score || 0), 0) / localPages.length)
      : 0;
    const aeoScore = Math.min(100, aeoEntries.length * 10); // 10+ published Q&A answers = full score

    return {
      total_pages: totalPages,
      indexed_pages: totalIndexed,
      non_indexed_pages: totalPages - totalIndexed,
      seo_score: avgScore,
      geo_score: geoScore,
      aeo_score: aeoScore,
      broken_links: 0,
      missing_alt: 0,
      duplicate_titles: 0,
      duplicate_descriptions: 0,
      missing_schema: 0,
      missing_canonical: totalPages - withCanonical,
      missing_h1: withoutMeta,
      multiple_h1: 0,
      tracked_keywords: keywords.length,
      total_redirects: totalRedirs,
      active_redirects: activeRedirs,
      geo_pages: localPages.length,
      aeo_entries: aeoEntries.length,
      competitors: 0,
      utm_campaigns: 0,
      backlinks: 0,
      // Not measured: no CrUX / PageSpeed integration yet.
      core_web_vitals: null as any,
      sitemap_health: {
        valid: true,
        entry_count: totalPages + totalProds + 5,
      },
      robots_health: {
        valid: true,
      },
      last_crawl: new Date().toISOString(),
    };
  }

  /* ── Sitemap Generation Data ── */

  static async getSitemapEntries(): Promise<Array<{
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: number;
  }>> {
    const [pages, products] = await Promise.all([
      dbQuery(`
        SELECT slug, updated_at FROM cms_page
        WHERE deleted_at IS NULL AND status = 'published'
        ORDER BY updated_at DESC
      `),
      dbQuery(`
        SELECT handle, updated_at FROM product
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC
      `),
    ]);

    const entries: any[] = [];

    for (const page of pages.rows) {
      entries.push({
        loc: `/${page.slug}`,
        lastmod: page.updated_at,
        changefreq: "weekly",
        priority: 0.7,
      });
    }

    for (const product of products.rows) {
      entries.push({
        loc: `/products/${product.handle}`,
        lastmod: product.updated_at,
        changefreq: "daily",
        priority: 0.8,
      });
    }

    return entries;
  }
}
