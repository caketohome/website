import { dbQuery } from "../db";
import { CmsPageDomain } from "../types/domain";

export class CmsRepository {
  /**
   * Find all CMS pages from PostgreSQL
   */
  static async findAllPages(): Promise<CmsPageDomain[]> {
    const res = await dbQuery(`SELECT * FROM "cms_page" ORDER BY created_at ASC`);
    return (res.rows || []).map((p: any) => {
      let blockParsed: any = { sections: [], draft_config: {}, published_config: null, version_history: [] };
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
        subheading: blockParsed.subheading || "",
        h1: blockParsed.h1 || "",
        intro_content: blockParsed.intro_content || "",
        breadcrumb_title: blockParsed.breadcrumb_title || "",
        announcement_bar: blockParsed.announcement_bar || null,
        header_config: blockParsed.header_config || null,
        visibility_rules: blockParsed.visibility_rules || null,
        robots_tag: blockParsed.robots_tag || "index, follow",
        keywords: blockParsed.keywords || "",
        og_title: blockParsed.og_title || "",
        og_description: blockParsed.og_description || "",
        og_type: blockParsed.og_type || "website",
        twitter_card: blockParsed.twitter_card || "summary_large_image",
        twitter_title: blockParsed.twitter_title || "",
        twitter_description: blockParsed.twitter_description || "",
        twitter_image: blockParsed.twitter_image || "",
        structured_data_type: blockParsed.structured_data_type || "WebPage",
        sitemap_include: blockParsed.sitemap_include ?? true,
        sitemap_priority: blockParsed.sitemap_priority || "0.7",
        sitemap_changefreq: blockParsed.sitemap_changefreq || "weekly",
        nav_location: blockParsed.nav_location || "none",
        hide_from_nav: blockParsed.hide_from_nav ?? false,
        sections: blockParsed.sections || [],
        theme: blockParsed.theme || blockParsed.published_config?.theme || blockParsed.draft_config?.theme || null,
        draft_config: blockParsed.draft_config || {},
        published_config: blockParsed.published_config || null,
        pdp_config: blockParsed.pdp_config || blockParsed.pdp || blockParsed.published_config?.pdp || blockParsed.draft_config?.pdp || null,
        page_type: p.type || "landing",
        version_history: blockParsed.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      };
    });
  }

  /**
   * Find active homepage sections from cms_homepage_section in PostgreSQL
   */
  static async findHomepageSections(): Promise<any[]> {
    try {
      const hasDel = await dbQuery("SELECT 1 FROM information_schema.columns WHERE table_name='cms_homepage_section' AND column_name='deleted_at'");
      const sql = hasDel.rows.length > 0
        ? `SELECT * FROM "cms_homepage_section"` +
          ` WHERE id LIKE 'sec_home_%' AND deleted_at IS NULL AND is_active = true` +
          ` ORDER BY sort_order ASC`
        : `SELECT * FROM "cms_homepage_section" ORDER BY sort_order ASC`;
      const res = await dbQuery(sql);
      return (res.rows || []).map((s: any) => {
        let cfg: any = {};
        if (s.config) {
          try {
            cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
          } catch {}
        }
        return {
          id: s.id,
          type: s.section_type || s.type || "custom",
          name: s.name || s.id,
          title: s.title || cfg.title || "",
          subtitle: s.subtitle || cfg.subtitle || "",
          config: cfg,
          order: s.sort_order ?? 0,
          enabled: s.is_active !== false,
        };
      });
    } catch (e: any) {
      console.warn("CMS homepage sections query notice:", e.message);
      return [];
    }
  }

  /**
   * Find page by slug or id
   */
  static async findPageBySlug(slug: string): Promise<CmsPageDomain | null> {
    const cleanSlug = (slug || "").replace(/^\//, "").trim() || "home";
    try {
      const hasDel = await dbQuery("SELECT 1 FROM information_schema.columns WHERE table_name='cms_page' AND column_name='deleted_at'");
      const sql = hasDel.rows.length > 0
        ? `SELECT * FROM "cms_page" 
           WHERE (slug = $1 OR id = $1 OR slug = $2 OR id = $2 OR (id = 'cmspg_home' AND ($1 = 'home' OR $2 = 'home'))) 
             AND deleted_at IS NULL 
           LIMIT 1`
        : `SELECT * FROM "cms_page" 
           WHERE (slug = $1 OR id = $1 OR slug = $2 OR id = $2 OR (id = 'cmspg_home' AND ($1 = 'home' OR $2 = 'home'))) 
           LIMIT 1`;
      const res = await dbQuery(sql, [slug, cleanSlug]);
      if (!res.rows || res.rows.length === 0) return null;
      const p = res.rows[0];
      let blockParsed: any = { sections: [], draft_config: {}, published_config: null, version_history: [] };
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
        subheading: blockParsed.subheading || "",
        h1: blockParsed.h1 || "",
        intro_content: blockParsed.intro_content || "",
        breadcrumb_title: blockParsed.breadcrumb_title || "",
        announcement_bar: blockParsed.announcement_bar || null,
        header_config: blockParsed.header_config || null,
        visibility_rules: blockParsed.visibility_rules || null,
        robots_tag: blockParsed.robots_tag || "index, follow",
        keywords: blockParsed.keywords || "",
        og_title: blockParsed.og_title || "",
        og_description: blockParsed.og_description || "",
        og_type: blockParsed.og_type || "website",
        twitter_card: blockParsed.twitter_card || "summary_large_image",
        twitter_title: blockParsed.twitter_title || "",
        twitter_description: blockParsed.twitter_description || "",
        twitter_image: blockParsed.twitter_image || "",
        structured_data_type: blockParsed.structured_data_type || "WebPage",
        sitemap_include: blockParsed.sitemap_include ?? true,
        sitemap_priority: blockParsed.sitemap_priority || "0.7",
        sections: blockParsed.sections || [],
        blocks: p.blocks,
        pdp_config: p.pdp_config || blockParsed.pdp_config || null,
        draft_config: blockParsed.draft_config || {},
        published_config: blockParsed.published_config || null,
        page_type: p.type || "landing",
        version_history: blockParsed.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      };
    } catch (e: any) {
      console.warn("CMS page query notice:", e.message);
      return null;
    }
  }

  /**
   * Upsert CMS page directly into PostgreSQL
   */
  static async savePage(page: Partial<CmsPageDomain>): Promise<CmsPageDomain> {
    const id = page.id || `page_${Date.now()}`;
    const slug = page.slug || id;
    const title = page.title || "Untitled Page";
    const status = page.status || "draft";

    const incomingPdpConfig = (page as any).pdp_config || (page as any).pdp || page.draft_config?.pdp || null;
    const draftConfig = { ...(page.draft_config || {}) };
    if (incomingPdpConfig) {
      draftConfig.pdp = incomingPdpConfig;
    }

    const blocks: any = {
      subheading: page.subheading || "",
      h1: page.h1 || "",
      intro_content: page.intro_content || "",
      breadcrumb_title: page.breadcrumb_title || "",
      announcement_bar: (page as any).announcement_bar || null,
      header_config: (page as any).header_config || null,
      visibility_rules: (page as any).visibility_rules || null,
      robots_tag: (page as any).robots_tag || "index, follow",
      keywords: (page as any).keywords || "",
      og_title: (page as any).og_title || "",
      og_description: (page as any).og_description || "",
      og_type: (page as any).og_type || "website",
      twitter_card: (page as any).twitter_card || "summary_large_image",
      twitter_title: (page as any).twitter_title || "",
      twitter_description: (page as any).twitter_description || "",
      twitter_image: (page as any).twitter_image || "",
      structured_data_type: (page as any).structured_data_type || "WebPage",
      sitemap_include: (page as any).sitemap_include ?? true,
      sitemap_priority: (page as any).sitemap_priority || "0.7",
      sitemap_changefreq: (page as any).sitemap_changefreq || "weekly",
      nav_location: (page as any).nav_location || "none",
      hide_from_nav: (page as any).hide_from_nav ?? false,
      sections: page.sections || [],
      theme: (page as any).theme || null,
      pdp_config: incomingPdpConfig,
      pdp: incomingPdpConfig,
      draft_config: draftConfig,
      published_config: status === "published"
        ? ((page as any).published_config && Object.keys((page as any).published_config).length > 0
            ? { ...(page as any).published_config, pdp: incomingPdpConfig || (page as any).published_config?.pdp }
            : { ...draftConfig, pdp: incomingPdpConfig })
        : ((page as any).published_config || null),
      version_history: Array.isArray(page.version_history) ? page.version_history.slice(-10) : [],
    };

    const res = await dbQuery(
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
      RETURNING *
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

    const p = res.rows[0];
    let blockParsed: any = {};
    if (p && p.blocks) {
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
      subheading: blockParsed.subheading || "",
      h1: blockParsed.h1 || "",
      intro_content: blockParsed.intro_content || "",
      breadcrumb_title: blockParsed.breadcrumb_title || "",
      announcement_bar: blockParsed.announcement_bar || null,
      header_config: blockParsed.header_config || null,
      visibility_rules: blockParsed.visibility_rules || null,
      robots_tag: blockParsed.robots_tag || "index, follow",
      keywords: blockParsed.keywords || "",
      og_title: blockParsed.og_title || "",
      og_description: blockParsed.og_description || "",
      og_type: blockParsed.og_type || "website",
      twitter_card: blockParsed.twitter_card || "summary_large_image",
      twitter_title: blockParsed.twitter_title || "",
      twitter_description: blockParsed.twitter_description || "",
      twitter_image: blockParsed.twitter_image || "",
      structured_data_type: blockParsed.structured_data_type || "WebPage",
      sitemap_include: blockParsed.sitemap_include ?? true,
      sitemap_priority: blockParsed.sitemap_priority || "0.7",
      sitemap_changefreq: blockParsed.sitemap_changefreq || "weekly",
      nav_location: blockParsed.nav_location || "none",
      hide_from_nav: blockParsed.hide_from_nav ?? false,
      sections: blockParsed.sections || [],
      theme: blockParsed.theme || blockParsed.published_config?.theme || blockParsed.draft_config?.theme || null,
      draft_config: blockParsed.draft_config || {},
      published_config: blockParsed.published_config || null,
      pdp_config: blockParsed.pdp_config || blockParsed.pdp || blockParsed.published_config?.pdp || blockParsed.draft_config?.pdp || null,
      version_history: blockParsed.version_history || [],
      created_at: p.created_at,
      updated_at: p.updated_at,
      published_at: p.published_at,
    };
  }

  /**
   * Publish CMS page directly in PostgreSQL
   */
  static async publishPage(id: string): Promise<{ success: boolean; page?: CmsPageDomain; error?: string }> {
    console.log("[publishPage] finding page:", id);
    const page = await CmsRepository.findPageBySlug(id);
    console.log("[publishPage] page found:", Boolean(page));
    if (!page) return { success: false, error: "Page not found in PostgreSQL" };

    const pdpCfg = page.pdp_config || page.draft_config?.pdp || (page as any).pdp || {};
    const publishedConfig = {
      sections: JSON.parse(JSON.stringify(page.sections || [])),
      banners: JSON.parse(JSON.stringify(page.draft_config?.banners || [])),
      products_mode: page.draft_config?.products_mode || "best_sellers",
      product_ids: JSON.parse(JSON.stringify(page.draft_config?.product_ids || [])),
      category_ids: JSON.parse(JSON.stringify(page.draft_config?.category_ids || [])),
      pdp: pdpCfg,
      pdp_config: pdpCfg,
      header_config: page.header_config,
      announcement_bar: page.announcement_bar,
      visibility_rules: page.visibility_rules,
      h1: page.h1 || page.title,
      subheading: page.subheading || "",
      intro_content: page.intro_content || "",
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      canonical_url: page.canonical_url,
      og_title: page.og_title,
      og_description: page.og_description,
      og_image: page.og_image,
      twitter_card: page.twitter_card,
      twitter_title: page.twitter_title,
      twitter_description: page.twitter_description,
      twitter_image: page.twitter_image,
      structured_data_type: page.structured_data_type,
      theme: page.theme,
    };

    const history = Array.isArray(page.version_history) ? page.version_history : [];
    const nextVer = (history.length > 0 ? (history[history.length - 1].version || history.length) : 0) + 1;
    const versionSnapshot = {
      version: nextVer,
      version_id: `v_${Date.now()}`,
      published_at: new Date().toISOString(),
      title: page.title,
      sections_count: (page.sections || []).length,
      published_config: publishedConfig,
      snapshot: publishedConfig,
      created_by: "Admin",
    };
    const updatedHistory = [...history.slice(-9), versionSnapshot];

    console.log("[publishPage] saving page...");
    const updated = await CmsRepository.savePage({
      ...page,
      status: "published",
      published_config: publishedConfig,
      pdp_config: pdpCfg,
      version_history: updatedHistory,
      published_at: new Date().toISOString(),
    });
    console.log("[publishPage] savePage complete:", updated?.id, updated?.status);

    // Persist immutable revision snapshot to relational cms_revision table
    try {
      const revisionId = `rev_${page.id}_${nextVer}_${Date.now()}`;
      await dbQuery(
        `INSERT INTO "cms_revision" (id, page_id, version, snapshot, author, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [revisionId, page.id, nextVer, JSON.stringify(publishedConfig), "Admin"]
      );
    } catch (revErr) {
      console.warn("[CmsRepository] Non-blocking revision write notice:", revErr);
    }

    return { success: true, page: updated };
  }

  /**
   * Duplicate CMS page in PostgreSQL
   */
  static async duplicatePage(id: string): Promise<CmsPageDomain | null> {
    const source = await CmsRepository.findPageBySlug(id);
    if (!source) return null;

    const allPages = await CmsRepository.findAllPages();
    const existingSlugs = allPages.map((p) => p.slug);
    let newSlug = `${source.slug}-copy`;
    let counter = 1;
    while (existingSlugs.includes(newSlug)) {
      newSlug = `${source.slug}-copy-${counter++}`;
    }

    const newId = `pg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cloned = await CmsRepository.savePage({
      ...source,
      id: newId,
      slug: newSlug,
      title: `${source.title} (Copy)`,
      status: "draft",
      published_at: null,
      published_config: null,
      version_history: [],
    });

    return cloned;
  }

  /**
   * Rollback CMS page to a specific version using PostgreSQL version history
   */
  static async rollbackPage(id: string, version: number | string): Promise<CmsPageDomain | null> {
    const page = await CmsRepository.findPageBySlug(id);
    if (!page) return null;

    const history = Array.isArray(page.version_history) ? page.version_history : [];

    // Also check cms_revision table if not found in blocks.version_history
    let entry = history.find(
      (h: any) =>
        h.version === Number(version) ||
        h.version_id === version ||
        String(h.version) === String(version)
    ) || (typeof version === "number" && history[version]) || history[history.length - 1];

    if (!entry) {
      try {
        const revRes = await dbQuery(
          `SELECT * FROM "cms_revision" WHERE page_id = $1 AND (version = $2 OR id = $3) ORDER BY version DESC LIMIT 1`,
          [page.id, Number(version) || 0, String(version)]
        );
        if (revRes.rows && revRes.rows.length > 0) {
          const raw = revRes.rows[0];
          let snap = {};
          try { snap = JSON.parse(raw.snapshot); } catch {}
          entry = { version: raw.version, snapshot: snap, published_config: snap };
        }
      } catch {}
    }

    if (!entry) return null;
    const snapshotConfig = entry.published_config || entry.snapshot || {};

    const restored: Partial<CmsPageDomain> = {
      ...page,
      status: "published",
      published_config: snapshotConfig,
      sections: snapshotConfig.sections || page.sections || [],
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version_history: history,
    };

    const saved = await CmsRepository.savePage(restored);
    return saved;
  }

  /**
   * Reorder CMS page sections directly in PostgreSQL
   */
  static async reorderSections(id: string, sectionIds: string[]): Promise<{ success: boolean; page?: CmsPageDomain; error?: string }> {
    const page = await CmsRepository.findPageBySlug(id);
    if (!page) return { success: false, error: "Page not found" };

    const existingSections = Array.isArray(page.sections) ? page.sections : [];
    const reordered: any[] = [];
    sectionIds.forEach((secId, i) => {
      const found = existingSections.find((s: any) => s.id === secId);
      if (found) {
        reordered.push({ ...found, order: i + 1 });
      }
    });

    // Append any sections not explicitly in sectionIds
    existingSections.forEach((s: any) => {
      if (!reordered.some((r) => r.id === s.id)) {
        reordered.push({ ...s, order: reordered.length + 1 });
      }
    });

    const updated = await CmsRepository.savePage({
      ...page,
      sections: reordered,
    });

    return { success: true, page: updated };
  }

  /**
   * Save Visual Page Builder layout blocks directly in PostgreSQL
   */
  static async savePageBuilderLayout(pageId: string, blocks: any[]): Promise<{ success: boolean; page?: CmsPageDomain; error?: string }> {
    const page = await CmsRepository.findPageBySlug(pageId);
    if (!page) return { success: false, error: "Page not found in PostgreSQL" };

    const updated = await CmsRepository.savePage({
      ...page,
      sections: Array.isArray(blocks) ? blocks : (page.sections || []),
    });

    return { success: true, page: updated };
  }

  /**
   * Find all CMS Content Blocks from PostgreSQL cms_block table
   */
  static async findAllBlocks(): Promise<any[]> {
    const res = await dbQuery(
      `SELECT * FROM "cms_block" WHERE deleted_at IS NULL ORDER BY created_at ASC`
    );
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((b: any) => {
        let parsedContent = b.content;
        try { parsedContent = JSON.parse(b.content); } catch {}
        return {
          id: b.id,
          name: b.name,
          identifier: b.identifier,
          type: b.type,
          content: parsedContent,
          language_code: b.language_code || "en",
          created_at: b.created_at,
          updated_at: b.updated_at,
        };
      });
    }

    // Default canonical blocks seeded in PostgreSQL if table is empty
    const defaults = [
      { id: "blk_usp_banner", name: "Value Proposition Strip", identifier: "usp_banner", type: "promo", content: JSON.stringify({ title: "Fresh Handcrafted Cakes", subtitle: "2-Hour Delivery Across Bangalore" }) },
      { id: "blk_announcement", name: "Global Announcement Bar", identifier: "announcement_bar", type: "notice", content: JSON.stringify({ message: "🎉 Use code CELEBRATE for 15% off your first cake order!", enabled: true }) },
      { id: "blk_freshness_guarantee", name: "Baking Quality Pledge", identifier: "freshness_guarantee", type: "trust_badge", content: JSON.stringify({ title: "100% Freshly Baked Daily", description: "Never frozen. Baked to order using premium European ingredients." }) },
    ];

    for (const d of defaults) {
      try {
        await dbQuery(
          `INSERT INTO "cms_block" (id, name, identifier, type, content, language_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'en', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [d.id, d.name, d.identifier, d.type, d.content]
        );
      } catch {}
    }

    const recheck = await dbQuery(`SELECT * FROM "cms_block" WHERE deleted_at IS NULL ORDER BY created_at ASC`);
    return (recheck.rows || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      identifier: b.identifier,
      type: b.type,
      content: b.content,
    }));
  }

  /**
   * Find CMS Navigation from PostgreSQL cms_navigation table
   */
  static async findNavigation(location: string): Promise<any | null> {
    try {
      const res = await dbQuery(
        `SELECT * FROM "cms_navigation" WHERE location = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1`,
        [location]
      );
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        let items: any[] = [];
        try { items = typeof row.items === "string" ? JSON.parse(row.items) : row.items; } catch {}
        return {
          id: row.id,
          name: row.name,
          location: row.location,
          items,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find SEO redirect from PostgreSQL cms_redirect table
   */
  static async findRedirect(fromPath: string): Promise<any | null> {
    const clean = fromPath.trim();
    const res = await dbQuery(
      `SELECT * FROM "cms_redirect" WHERE from_path = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1`,
      [clean]
    );
    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Unpublish CMS page directly in PostgreSQL
   */
  static async unpublishPage(id: string): Promise<{ success: boolean; page?: CmsPageDomain; error?: string }> {
    const page = await CmsRepository.findPageBySlug(id);
    if (!page) return { success: false, error: "Page not found in PostgreSQL" };
    const updated = await CmsRepository.savePage({
      ...page,
      status: "draft",
      published_at: null,
    });
    return { success: true, page: updated };
  }

  /**
   * Delete CMS page in PostgreSQL
   */
  static async deletePage(id: string): Promise<void> {
    await dbQuery(`DELETE FROM "cms_page" WHERE id = $1`, [id]);
  }

  /**
   * Automatically publish scheduled CMS pages whose scheduled_at <= NOW()
   */
  static async publishScheduledPages(): Promise<{ processed: number; published: string[] }> {
    try {
      const duePages = await dbQuery(
        `SELECT id, slug, title FROM "cms_page"
         WHERE status = 'scheduled'
           AND scheduled_at IS NOT NULL
           AND scheduled_at <= NOW()
           AND deleted_at IS NULL`
      );
      const published: string[] = [];
      if (duePages.rows && duePages.rows.length > 0) {
        for (const row of duePages.rows) {
          await CmsRepository.publishPage(row.id);
          published.push(row.slug);
        }
      }
      return { processed: published.length, published };
    } catch (err: any) {
      console.error("[CmsRepository.publishScheduledPages Error]:", err?.message || err);
      return { processed: 0, published: [] };
    }
  }
}
