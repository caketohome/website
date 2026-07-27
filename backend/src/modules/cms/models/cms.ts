import { model } from "@medusajs/utils";

/**
 * CMS Page — the core content entity.
 * Supports pages, blog posts (type=blog), static pages, landing pages.
 * Status: draft | published | archived. Soft-delete via Medusa's deleted_at.
 * Scheduling via published_at / archived_at.
 * Localization via language_code + translation rows.
 * SEO meta stored inline. Revision history via cms_revision.
 */
export const CmsPage = model.define("cms_page", {
    id: model
        .id({
            prefix: "cmspg",
        })
        .primaryKey(),
    slug: model.text().searchable(),
    title: model.text().searchable(),
    type: model.text().default("page"), // page | blog | landing | static
    status: model.text().default("draft"), // draft | published | archived
    // JSON array of content blocks (rich structured blocks).
    blocks: model.text().nullable(),
    // SEO
    meta_title: model.text().nullable(),
    meta_description: model.text().nullable(),
    canonical_url: model.text().nullable(),
    og_image: model.text().nullable(),
    // Blog fields
    author: model.text().nullable(),
    excerpt: model.text().nullable(),
    featured_image: model.text().nullable(),
    reading_time: model.number().default(0),
    // Scheduling
    published_at: model.dateTime().nullable(),
    archived_at: model.dateTime().nullable(),
    // Localization
    language_code: model.text().default("en"),
    // Template reference
    template_id: model.text().nullable(),
    // Category link (blog)
    category_id: model.text().nullable(),
    // Page Configurator Extensions
    parent_id: model.text().nullable(),
    sort_order: model.number().default(0),
    breadcrumb_title: model.text().nullable(),
    url_path: model.text().nullable(),
    robots_tag: model.text().default("index, follow"),
    twitter_card: model.text().default("summary_large_image"),
    structured_data_type: model.text().default("WebPage"),
    visibility_rules: model.text().nullable(), // JSON: public, logged_in, members, branch_ids, country, city, devices, schedule
    nav_location: model.text().default("none"), // header | footer | mobile | mega_menu | none
    hide_from_nav: model.boolean().default(false),
    analytics_summary: model.text().nullable(), // JSON: views, visitors, bounce_rate, orders, revenue, conversion_rate, cta_clicks
});

/**
 * CMS Category — for blog and page categorization.
 */
export const CmsCategory = model.define("cms_category", {
    id: model
        .id({
            prefix: "cmscat",
        })
        .primaryKey(),
    name: model.text(),
    slug: model.text().searchable(),
    description: model.text().nullable(),
    parent_id: model.text().nullable(),
});

/**
 * CMS Tag — many-to-many with pages (stored as JSON on page for simplicity).
 */
export const CmsTag = model.define("cms_tag", {
    id: model
        .id({
            prefix: "cmstag",
        })
        .primaryKey(),
    name: model.text(),
    slug: model.text().searchable(),
});

/**
 * Reusable content block — can be referenced by multiple pages.
 */
export const CmsBlock = model.define("cms_block", {
    id: model
        .id({
            prefix: "cmsblk",
        })
        .primaryKey(),
    name: model.text(),
    identifier: model.text().searchable(),
    type: model.text().default("rich_text"),
    content: model.text().nullable(),
    language_code: model.text().default("en"),
});

/**
 * Homepage section — a single row in the homepage builder.
 * Ordered by `sort_order`. Section type determines the storefront renderer.
 */
export const CmsHomepageSection = model.define("cms_homepage_section", {
    id: model
        .id({
            prefix: "cmshs",
        })
        .primaryKey(),
    name: model.text(),
    section_type: model.text(), // hero | slider | featured_cakes | categories | etc.
    title: model.text().nullable(),
    subtitle: model.text().nullable(),
    // JSON config: product ids, category ids, images, links, visibility rules.
    config: model.text().nullable(),
    sort_order: model.number().default(0),
    is_active: model.boolean().default(true),
    // Scheduling
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    // Conditional visibility (JSON: device, branch, segment rules)
    visibility: model.text().nullable(),
    // Theme overrides (JSON)
    theme: model.text().nullable(),
    language_code: model.text().default("en"),
});

/**
 * Banner — homepage banner slider item.
 */
export const CmsBanner = model.define("cms_banner", {
    id: model
        .id({
            prefix: "cmsbnr",
        })
        .primaryKey(),
    title: model.text().nullable(),
    image_url: model.text(),
    mobile_image_url: model.text().nullable(),
    link_url: model.text().nullable(),
    alt_text: model.text().nullable(),
    sort_order: model.number().default(0),
    is_active: model.boolean().default(true),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    // Targeting (JSON: branch_ids, segments, devices)
    target: model.text().nullable(),
    language_code: model.text().default("en"),
});

/**
 * Navigation — a named navigation tree (header, footer, mega-menu, sidebar, mobile).
 * Items stored as JSON tree.
 */
export const CmsNavigation = model.define("cms_navigation", {
    id: model
        .id({
            prefix: "cmsnav",
        })
        .primaryKey(),
    name: model.text(),
    location: model.text(), // header | footer | mega_menu | sidebar | mobile
    // JSON array of nav items: { label, type, url, page_slug, category_slug, image, icon, badge, children, schedule, permissions }
    items: model.text().nullable(),
    is_active: model.boolean().default(true),
    language_code: model.text().default("en"),
});

/**
 * Redirect — 301/302 redirect manager.
 */
export const CmsRedirect = model.define("cms_redirect", {
    id: model
        .id({
            prefix: "cmsred",
        })
        .primaryKey(),
    from_path: model.text().searchable(),
    to_url: model.text(),
    redirect_type: model.number().default(301), // 301 | 302
    is_active: model.boolean().default(true),
});

/**
 * Template — reusable page/homepage templates.
 */
export const CmsTemplate = model.define("cms_template", {
    id: model
        .id({
            prefix: "cmstpl",
        })
        .primaryKey(),
    name: model.text(),
    type: model.text().default("page"), // page | homepage | section
    // JSON template structure
    structure: model.text().nullable(),
    description: model.text().nullable(),
});

/**
 * Revision — version history for cms_page.
 */
export const CmsRevision = model.define("cms_revision", {
    id: model
        .id({
            prefix: "cmsrev",
        })
        .primaryKey(),
    page_id: model.text(),
    version: model.number().default(1),
    // Snapshot of the page at this revision (JSON)
    snapshot: model.text().nullable(),
    author: model.text().nullable(),
});

/**
 * Asset reference — links a media asset to a CMS entity.
 */
export const CmsAssetReference = model.define("cms_asset_reference", {
    id: model
        .id({
            prefix: "cmsar",
        })
        .primaryKey(),
    entity_type: model.text(), // cms_page | cms_banner | cms_homepage_section | blog
    entity_id: model.text(),
    media_id: model.text(),
    field: model.text().nullable(), // featured_image | og_image | block_image
});
