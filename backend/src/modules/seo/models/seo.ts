import { model } from "@medusajs/framework/utils";

// ═══════════════════════════════════════════════════════════════
// SEO Page — per-page SEO configuration for any entity
// ═══════════════════════════════════════════════════════════════
export const SeoPage = model.define("seo_page", {
    id: model.id({ prefix: "seopg" }).primaryKey(),
    entity_type: model.text(), // product | category | branch | city | cms | blog | geo_landing
    entity_id: model.text(),
    slug: model.text().searchable(),
    url: model.text(),
    meta_title: model.text().nullable(),
    meta_description: model.text().nullable(),
    canonical_url: model.text().nullable(),
    robots_directive: model.text().nullable(), // index,follow | noindex,nofollow etc.
    keywords: model.text().nullable(), // comma-separated
    og_title: model.text().nullable(),
    og_description: model.text().nullable(),
    og_image: model.text().nullable(),
    og_type: model.text().nullable(),
    twitter_card: model.text().nullable(),
    twitter_title: model.text().nullable(),
    twitter_description: model.text().nullable(),
    twitter_image: model.text().nullable(),
    h1_text: model.text().nullable(),
    h1_count: model.number().default(0),
    word_count: model.number().default(0),
    has_schema: model.boolean().default(false),
    schema_types: model.text().nullable(), // JSON array of schema types
    internal_links_count: model.number().default(0),
    external_links_count: model.number().default(0),
    images_count: model.number().default(0),
    images_missing_alt: model.number().default(0),
    seo_score: model.number().default(0),
    geo_score: model.number().default(0),
    aeo_score: model.number().default(0),
    status: model.enum(["draft", "published", "archived"]).default("published"),
    last_crawled_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Page Score — historical scoring snapshots
// ═══════════════════════════════════════════════════════════════
export const SeoPageScore = model.define("seo_page_score", {
    id: model.id({ prefix: "seoscr" }).primaryKey(),
    seo_page_id: model.text(),
    seo_score: model.number().default(0),
    geo_score: model.number().default(0),
    aeo_score: model.number().default(0),
    overall_score: model.number().default(0),
    issues: model.text().nullable(), // JSON array of issues
    recommendations: model.text().nullable(), // JSON array
    snapshot_date: model.text(), // YYYY-MM-DD
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Keyword Group
// ═══════════════════════════════════════════════════════════════
export const SeoKeywordGroup = model.define("seo_keyword_group", {
    id: model.id({ prefix: "seokg" }).primaryKey(),
    name: model.text(),
    type: model.text().default("general"), // brand | product | city | competitor | general
    description: model.text().nullable(),
    color: model.text().nullable(),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Keyword — tracked keywords with ranking
// ═══════════════════════════════════════════════════════════════
export const SeoKeyword = model.define("seo_keyword", {
    id: model.id({ prefix: "seokey" }).primaryKey(),
    keyword: model.text().searchable(),
    group_id: model.text().nullable(),
    search_volume: model.number().default(0),
    difficulty: model.number().default(0),
    current_position: model.number().default(0),
    previous_position: model.number().default(0),
    best_position: model.number().default(0),
    target_url: model.text().nullable(),
    location: model.text().nullable(), // city or region
    device: model.text().default("desktop"), // desktop | mobile
    search_engine: model.text().default("google"),
    status: model.enum(["tracking", "paused", "archived"]).default("tracking"),
    last_checked_at: model.dateTime().nullable(),
    ranking_history: model.text().nullable(), // JSON array of {date, position}
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Redirect — 301/302/307/410 redirect rules
// ═══════════════════════════════════════════════════════════════
export const SeoRedirect = model.define("seo_redirect", {
    id: model.id({ prefix: "seord" }).primaryKey(),
    source_url: model.text().searchable(),
    target_url: model.text().nullable(), // null for 410 Gone
    status_code: model.number().default(301), // 301 | 302 | 307 | 410
    is_regex: model.boolean().default(false),
    is_active: model.boolean().default(true),
    hit_count: model.number().default(0),
    last_hit_at: model.dateTime().nullable(),
    notes: model.text().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Redirect Log — individual redirect hits
// ═══════════════════════════════════════════════════════════════
export const SeoRedirectLog = model.define("seo_redirect_log", {
    id: model.id({ prefix: "seorl" }).primaryKey(),
    redirect_id: model.text(),
    source_url: model.text(),
    target_url: model.text().nullable(),
    status_code: model.number(),
    user_agent: model.text().nullable(),
    referer: model.text().nullable(),
    ip_address: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Broken Link
// ═══════════════════════════════════════════════════════════════
export const SeoBrokenLink = model.define("seo_broken_link", {
    id: model.id({ prefix: "seobl" }).primaryKey(),
    page_url: model.text(),
    broken_url: model.text(),
    link_text: model.text().nullable(),
    status_code: model.number().default(404),
    link_type: model.text().default("internal"), // internal | external
    is_resolved: model.boolean().default(false),
    resolved_at: model.dateTime().nullable(),
    found_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Internal Link
// ═══════════════════════════════════════════════════════════════
export const SeoInternalLink = model.define("seo_internal_link", {
    id: model.id({ prefix: "seoil" }).primaryKey(),
    source_url: model.text(),
    target_url: model.text(),
    anchor_text: model.text().nullable(),
    link_type: model.text().default("content"), // content | navigation | footer | sidebar
    is_nofollow: model.boolean().default(false),
    source_entity_type: model.text().nullable(),
    source_entity_id: model.text().nullable(),
    target_entity_type: model.text().nullable(),
    target_entity_id: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Schema Template — reusable structured data templates
// ═══════════════════════════════════════════════════════════════
export const SeoSchemaTemplate = model.define("seo_schema_template", {
    id: model.id({ prefix: "seost" }).primaryKey(),
    name: model.text(),
    schema_type: model.text(), // Organization | LocalBusiness | Product | FAQ | HowTo | Recipe | etc.
    template_json: model.text(), // JSON template with placeholders
    description: model.text().nullable(),
    is_active: model.boolean().default(true),
    usage_count: model.number().default(0),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Schema Instance — applied schema per page
// ═══════════════════════════════════════════════════════════════
export const SeoSchemaInstance = model.define("seo_schema_instance", {
    id: model.id({ prefix: "seosi" }).primaryKey(),
    seo_page_id: model.text(),
    template_id: model.text().nullable(),
    schema_type: model.text(),
    schema_json: model.text(), // actual JSON-LD
    is_valid: model.boolean().default(true),
    validation_errors: model.text().nullable(), // JSON array
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Crawl History
// ═══════════════════════════════════════════════════════════════
export const SeoCrawlHistory = model.define("seo_crawl_history", {
    id: model.id({ prefix: "seoch" }).primaryKey(),
    crawl_type: model.text().default("full"), // full | partial | broken_links | images | content
    pages_scanned: model.number().default(0),
    issues_found: model.number().default(0),
    duration_ms: model.number().default(0),
    status: model.enum(["running", "completed", "failed"]).default("completed"),
    summary: model.text().nullable(), // JSON summary
    triggered_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Health Report — periodic snapshots
// ═══════════════════════════════════════════════════════════════
export const SeoHealthReport = model.define("seo_health_report", {
    id: model.id({ prefix: "seohr" }).primaryKey(),
    report_date: model.text(), // YYYY-MM-DD
    overall_score: model.number().default(0),
    seo_score: model.number().default(0),
    geo_score: model.number().default(0),
    aeo_score: model.number().default(0),
    total_pages: model.number().default(0),
    indexed_pages: model.number().default(0),
    non_indexed_pages: model.number().default(0),
    broken_links: model.number().default(0),
    missing_alt: model.number().default(0),
    missing_schema: model.number().default(0),
    missing_canonical: model.number().default(0),
    missing_h1: model.number().default(0),
    multiple_h1: model.number().default(0),
    duplicate_titles: model.number().default(0),
    duplicate_descriptions: model.number().default(0),
    thin_pages: model.number().default(0),
    avg_page_speed: model.number().default(0),
    details: model.text().nullable(), // JSON full details
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Image Audit
// ═══════════════════════════════════════════════════════════════
export const SeoImageAudit = model.define("seo_image_audit", {
    id: model.id({ prefix: "seoia" }).primaryKey(),
    page_url: model.text(),
    image_url: model.text(),
    alt_text: model.text().nullable(),
    has_alt: model.boolean().default(false),
    has_width: model.boolean().default(false),
    has_height: model.boolean().default(false),
    has_lazy_loading: model.boolean().default(false),
    file_size_kb: model.number().default(0),
    format: model.text().nullable(), // jpg | png | webp | avif | svg
    is_broken: model.boolean().default(false),
    suggested_alt: model.text().nullable(),
    entity_type: model.text().nullable(),
    entity_id: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Competitor
// ═══════════════════════════════════════════════════════════════
export const SeoCompetitor = model.define("seo_competitor", {
    id: model.id({ prefix: "seocp" }).primaryKey(),
    name: model.text(),
    domain: model.text(),
    description: model.text().nullable(),
    tracked_keywords: model.text().nullable(), // JSON array
    notes: model.text().nullable(),
    status: model.enum(["active", "paused", "archived"]).default("active"),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO GEO Page — auto-generated landing pages
// ═══════════════════════════════════════════════════════════════
export const SeoGeoPage = model.define("seo_geo_page", {
    id: model.id({ prefix: "seogp" }).primaryKey(),
    page_type: model.text().default("city"), // city | area | pincode | nearby
    city: model.text().nullable(),
    area: model.text().nullable(),
    pincode: model.text().nullable(),
    branch_id: model.text().nullable(),
    slug: model.text().searchable(),
    title: model.text(),
    meta_title: model.text().nullable(),
    meta_description: model.text().nullable(),
    h1_text: model.text().nullable(),
    content_html: model.text().nullable(),
    faqs: model.text().nullable(), // JSON array of {question, answer}
    schema_json: model.text().nullable(),
    breadcrumbs: model.text().nullable(), // JSON array
    internal_links: model.text().nullable(), // JSON array
    keywords: model.text().nullable(),
    status: model.enum(["draft", "published", "archived"]).default("published"),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO AEO Entry — FAQ, HowTo, Speakable answers
// ═══════════════════════════════════════════════════════════════
export const SeoAeoEntry = model.define("seo_aeo_entry", {
    id: model.id({ prefix: "seoae" }).primaryKey(),
    entry_type: model.text().default("faq"), // faq | howto | speakable | recipe | video
    question: model.text().nullable(),
    answer: model.text().nullable(),
    steps: model.text().nullable(), // JSON array for HowTo
    entity_type: model.text().nullable(), // product | category | branch | page
    entity_id: model.text().nullable(),
    page_url: model.text().nullable(),
    schema_json: model.text().nullable(),
    quality_score: model.number().default(0),
    is_featured: model.boolean().default(false),
    status: model.enum(["draft", "published", "archived"]).default("published"),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Content Audit
// ═══════════════════════════════════════════════════════════════
export const SeoContentAudit = model.define("seo_content_audit", {
    id: model.id({ prefix: "seoca" }).primaryKey(),
    page_url: model.text(),
    entity_type: model.text().nullable(),
    entity_id: model.text().nullable(),
    word_count: model.number().default(0),
    readability_score: model.number().default(0),
    keyword_density: model.number().default(0),
    is_thin: model.boolean().default(false),
    is_duplicate: model.boolean().default(false),
    duplicate_of: model.text().nullable(),
    has_h1: model.boolean().default(false),
    h1_count: model.number().default(0),
    has_meta_title: model.boolean().default(false),
    has_meta_description: model.boolean().default(false),
    has_canonical: model.boolean().default(false),
    has_schema: model.boolean().default(false),
    issues: model.text().nullable(), // JSON array
    recommendations: model.text().nullable(), // JSON array
    audit_date: model.text(), // YYYY-MM-DD
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Page Speed — Core Web Vitals
// ═══════════════════════════════════════════════════════════════
export const SeoPageSpeed = model.define("seo_page_speed", {
    id: model.id({ prefix: "seops" }).primaryKey(),
    page_url: model.text(),
    device: model.text().default("mobile"), // mobile | desktop
    lcp_ms: model.number().default(0), // Largest Contentful Paint
    cls: model.number().default(0), // Cumulative Layout Shift (x1000 for storage)
    inp_ms: model.number().default(0), // Interaction to Next Paint
    fcp_ms: model.number().default(0), // First Contentful Paint
    ttfb_ms: model.number().default(0), // Time to First Byte
    speed_index: model.number().default(0),
    performance_score: model.number().default(0), // 0-100
    js_size_kb: model.number().default(0),
    css_size_kb: model.number().default(0),
    image_size_kb: model.number().default(0),
    total_size_kb: model.number().default(0),
    requests_count: model.number().default(0),
    measured_at: model.text(), // ISO timestamp
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Audit Log — modification history
// ═══════════════════════════════════════════════════════════════
export const SeoAuditLog = model.define("seo_audit_log", {
    id: model.id({ prefix: "seoal" }).primaryKey(),
    action: model.text(), // created | updated | deleted | scanned | generated | exported | imported
    entity_type: model.text(), // seo_page | keyword | redirect | schema | geo_page | etc.
    entity_id: model.text().nullable(),
    details: model.text().nullable(), // JSON with before/after
    user: model.text().nullable(),
    ip_address: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO UTM Campaign
// ═══════════════════════════════════════════════════════════════
export const SeoUtmCampaign = model.define("seo_utm_campaign", {
    id: model.id({ prefix: "seout" }).primaryKey(),
    name: model.text(),
    url: model.text(),
    source: model.text(),
    medium: model.text(),
    campaign: model.text(),
    term: model.text().nullable(),
    content: model.text().nullable(),
    generated_url: model.text(),
    click_count: model.number().default(0),
    status: model.enum(["active", "paused", "archived"]).default("active"),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Robots History — versioned robots.txt
// ═══════════════════════════════════════════════════════════════
export const SeoRobotsHistory = model.define("seo_robots_history", {
    id: model.id({ prefix: "seorh" }).primaryKey(),
    content: model.text(),
    version: model.number().default(1),
    environment: model.text().default("production"), // production | staging | development
    is_active: model.boolean().default(false),
    notes: model.text().nullable(),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Social Card
// ═══════════════════════════════════════════════════════════════
export const SeoSocialCard = model.define("seo_social_card", {
    id: model.id({ prefix: "seosc" }).primaryKey(),
    entity_type: model.text(),
    entity_id: model.text(),
    platform: model.text().default("opengraph"), // opengraph | twitter | linkedin | pinterest
    title: model.text().nullable(),
    description: model.text().nullable(),
    image_url: model.text().nullable(),
    card_type: model.text().nullable(), // summary | summary_large_image | player | app
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Backlink
// ═══════════════════════════════════════════════════════════════
export const SeoBacklink = model.define("seo_backlink", {
    id: model.id({ prefix: "seobk" }).primaryKey(),
    source_domain: model.text(),
    source_url: model.text(),
    target_url: model.text(),
    anchor_text: model.text().nullable(),
    domain_authority: model.number().default(0),
    is_dofollow: model.boolean().default(true),
    is_active: model.boolean().default(true),
    first_seen: model.text().nullable(),
    last_checked: model.text().nullable(),
    status: model.enum(["active", "lost", "broken"]).default("active"),
    created_by: model.text().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SEO Report — generated reports
// ═══════════════════════════════════════════════════════════════
export const SeoReport = model.define("seo_report", {
    id: model.id({ prefix: "seorp" }).primaryKey(),
    report_type: model.text().default("overall"), // overall | branch | city | product | category | weekly | monthly
    report_period: model.text(), // YYYY-MM-DD or YYYY-WW
    title: model.text(),
    summary: model.text().nullable(),
    data: model.text().nullable(), // JSON full report data
    format: model.text().default("json"), // json | csv | pdf
    status: model.enum(["generating", "completed", "failed"]).default("completed"),
    file_url: model.text().nullable(),
    created_by: model.text().nullable(),
});
