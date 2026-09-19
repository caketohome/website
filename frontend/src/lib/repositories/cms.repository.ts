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
    const res = await dbQuery(
      `SELECT * FROM "cms_homepage_section"` +
      ` WHERE id LIKE 'sec_home_%' AND deleted_at IS NULL AND is_active = true` +
      ` ORDER BY sort_order ASC`
    );
    return (res.rows || []).map((s: any) => {
      let cfg: any = {};
      if (s.config) {
        try {
          cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
        } catch {}
      }
      return {
        id: s.id,
        type: s.section_type || s.type,
        name: s.name,
        title: s.title || cfg.title || "",
        subtitle: s.subtitle || cfg.subtitle || "",
        config: cfg,
        order: s.sort_order ?? 0,
        enabled: s.is_active !== false,
      };
    });
  }

  /**
   * Find page by slug or id
   */
  static async findPageBySlug(slug: string): Promise<CmsPageDomain | null> {
    const cleanSlug = (slug || "").replace(/^\//, "").trim() || "home";
    const res = await dbQuery(
      `SELECT * FROM "cms_page" 
       WHERE (slug = $1 OR id = $1 OR slug = $2 OR id = $2 OR (id = 'cmspg_home' AND ($1 = 'home' OR $2 = 'home'))) 
         AND deleted_at IS NULL 
       LIMIT 1`,
      [slug, cleanSlug]
    );
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

    return { success: true, page: updated };
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
}
