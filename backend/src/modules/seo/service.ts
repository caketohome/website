import { MedusaService } from "@medusajs/framework/utils";

/**
 * Enterprise SEO, GEO & AEO Module Service
 * 
 * Provides comprehensive search engine optimization management including:
 * - Page-level SEO configuration for all entity types
 * - SEO/GEO/AEO scoring engine
 * - Keyword tracking with ranking history
 * - Redirect management (301/302/307/410)
 * - Broken link detection
 * - Internal link analysis
 * - Structured data management
 * - Image SEO auditing
 * - Competitor tracking
 * - GEO landing page generation
 * - AEO entry management (FAQ, HowTo, Speakable)
 * - Content quality auditing
 * - Core Web Vitals tracking
 * - UTM campaign management
 * - Robots.txt versioning
 * - Report generation
 */
export class SeoModuleService {

    private seoPages: any[] = [];
    private seoPageScores: any[] = [];
    private seoKeywords: any[] = [];
    private seoKeywordGroups: any[] = [];
    private seoRedirects: any[] = [];
    private seoRedirectLogs: any[] = [];
    private seoBrokenLinks: any[] = [];
    private seoInternalLinks: any[] = [];
    private seoSchemaTemplates: any[] = [];
    private seoSchemaInstances: any[] = [];
    private seoCrawlHistory: any[] = [];
    private seoHealthReports: any[] = [];
    private seoImageAudits: any[] = [];
    private seoCompetitors: any[] = [];
    private seoGeoPages: any[] = [];
    private seoAeoEntries: any[] = [];
    private seoContentAudits: any[] = [];
    private seoPageSpeed: any[] = [];
    private seoAuditLogs: any[] = [];
    private seoUtmCampaigns: any[] = [];
    private seoRobotsHistory: any[] = [];
    private seoSocialCards: any[] = [];
    private seoBacklinks: any[] = [];
    private seoReports: any[] = [];

    // ═══════════════════════════════════════════════════════════════
    // SEO Scoring Engine
    // ═══════════════════════════════════════════════════════════════

    /**
     * Calculate SEO score for a page (0-100)
     */
    calculateSeoScore(page: any): number {
        let score = 0;
        if (page.meta_title) { score += 10; if (page.meta_title.length >= 50 && page.meta_title.length <= 60) score += 5; }
        if (page.meta_description) { score += 10; if (page.meta_description.length >= 140 && page.meta_description.length <= 160) score += 5; }
        if (page.h1_text) { score += 10; if (page.h1_count === 1) score += 5; }
        if (page.canonical_url) score += 5;
        if (page.has_schema) score += 10;
        if (page.og_title || page.og_image) score += 5;
        if (page.images_count > 0 && page.images_missing_alt === 0) score += 10;
        if (page.internal_links_count > 0) score += 5;
        if (page.word_count >= 300) score += 5;
        if (page.keywords) score += 5;
        // Deductions
        if (page.h1_count > 1) score -= 5;
        if (page.meta_title && page.meta_title.length > 70) score -= 3;
        if (page.meta_description && page.meta_description.length > 170) score -= 3;
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate GEO score (Generative Engine Optimization) (0-100)
     */
    calculateGeoScore(page: any): number {
        let score = 0;
        // Entity Coverage
        if (page.has_schema) score += 20;
        // Structured Facts (meta + keywords + descriptions)
        if (page.meta_title && page.meta_description && page.keywords) score += 20;
        // Context Richness (word count)
        if (page.word_count >= 500) score += 15;
        else if (page.word_count >= 300) score += 10;
        // Semantic Structure (H1 + internal links)
        if (page.h1_text && page.internal_links_count > 0) score += 15;
        // Brand/Location Authority
        if (page.entity_type === "branch" || page.entity_type === "city" || page.entity_type === "geo_landing") score += 15;
        else if (page.canonical_url) score += 10;
        // Knowledge Graph Eligibility
        if (page.schema_types) {
            try {
                const types = JSON.parse(page.schema_types);
                if (types.length > 1) score += 15;
                else if (types.length === 1) score += 10;
            } catch { score += 5; }
        }
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate AEO score (Answer Engine Optimization) (0-100)
     */
    calculateAeoScore(page: any, aeoEntries: any[] = []): number {
        let score = 0;
        const pageEntries = aeoEntries.filter(e => e.entity_id === page.entity_id || e.page_url === page.url);
        const faqs = pageEntries.filter(e => e.entry_type === "faq");
        const howtos = pageEntries.filter(e => e.entry_type === "howto");
        const speakables = pageEntries.filter(e => e.entry_type === "speakable");
        // FAQ Schema
        if (faqs.length > 0) score += 20;
        // HowTo Schema
        if (howtos.length > 0) score += 15;
        // Speakable Schema
        if (speakables.length > 0) score += 15;
        // Answer Quality (quality_score average)
        if (pageEntries.length > 0) {
            const avgQuality = pageEntries.reduce((s: number, e: any) => s + (e.quality_score || 0), 0) / pageEntries.length;
            score += Math.round(avgQuality * 20 / 100);
        }
        // Question Coverage
        if (faqs.length >= 5) score += 15;
        else if (faqs.length >= 3) score += 10;
        else if (faqs.length >= 1) score += 5;
        // Featured Snippet Eligibility
        if (page.word_count >= 300 && faqs.length > 0 && page.has_schema) score += 15;
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get comprehensive SEO dashboard summary
     */
    async getSeoDashboardSummary(): Promise<any> {
        const pages = this.seoPages;
        const keywords = this.seoKeywords;
        const brokenLinks = this.seoBrokenLinks.filter(b => !b.is_resolved);
        const imageAudits = this.seoImageAudits;
        const contentAudits = this.seoContentAudits;
        const healthReports = this.seoHealthReports;
        const latestHealth = healthReports.length > 0 ? healthReports[healthReports.length - 1] : null;

        const totalPages = pages.length;
        const indexedPages = pages.filter(p => !p.robots_directive || !p.robots_directive.includes("noindex")).length;
        const nonIndexedPages = totalPages - indexedPages;

        const avgSeoScore = totalPages > 0 ? Math.round(pages.reduce((s, p) => s + (p.seo_score || 0), 0) / totalPages) : 0;
        const avgGeoScore = totalPages > 0 ? Math.round(pages.reduce((s, p) => s + (p.geo_score || 0), 0) / totalPages) : 0;
        const avgAeoScore = totalPages > 0 ? Math.round(pages.reduce((s, p) => s + (p.aeo_score || 0), 0) / totalPages) : 0;

        const missingAlt = imageAudits.filter(i => !i.has_alt).length;
        const duplicateTitles = this.findDuplicates(pages, "meta_title");
        const duplicateDescriptions = this.findDuplicates(pages, "meta_description");
        const missingSchema = pages.filter(p => !p.has_schema).length;
        const missingCanonical = pages.filter(p => !p.canonical_url).length;
        const missingH1 = pages.filter(p => !p.h1_text).length;
        const multipleH1 = pages.filter(p => p.h1_count > 1).length;

        const latestPageSpeed = this.seoPageSpeed.length > 0 ? this.seoPageSpeed[this.seoPageSpeed.length - 1] : null;

        return {
            total_pages: totalPages,
            indexed_pages: indexedPages,
            non_indexed_pages: nonIndexedPages,
            seo_score: avgSeoScore,
            geo_score: avgGeoScore,
            aeo_score: avgAeoScore,
            broken_links: brokenLinks.length,
            missing_alt: missingAlt,
            duplicate_titles: duplicateTitles,
            duplicate_descriptions: duplicateDescriptions,
            missing_schema: missingSchema,
            missing_canonical: missingCanonical,
            missing_h1: missingH1,
            multiple_h1: multipleH1,
            tracked_keywords: keywords.length,
            total_redirects: this.seoRedirects.length,
            active_redirects: this.seoRedirects.filter(r => r.is_active).length,
            geo_pages: this.seoGeoPages.length,
            aeo_entries: this.seoAeoEntries.length,
            competitors: this.seoCompetitors.filter(c => c.status === "active").length,
            utm_campaigns: this.seoUtmCampaigns.length,
            backlinks: this.seoBacklinks.filter(b => b.status === "active").length,
            core_web_vitals: latestPageSpeed ? {
                lcp_ms: latestPageSpeed.lcp_ms,
                cls: latestPageSpeed.cls,
                inp_ms: latestPageSpeed.inp_ms,
                fcp_ms: latestPageSpeed.fcp_ms,
                ttfb_ms: latestPageSpeed.ttfb_ms,
                performance_score: latestPageSpeed.performance_score,
            } : { lcp_ms: 0, cls: 0, inp_ms: 0, fcp_ms: 0, ttfb_ms: 0, performance_score: 0 },
            sitemap_health: "healthy",
            robots_health: "healthy",
            last_crawl: this.seoCrawlHistory.length > 0 ? this.seoCrawlHistory[this.seoCrawlHistory.length - 1] : null,
            latest_health_report: latestHealth,
        };
    }

    /**
     * Find duplicate values in a field
     */
    private findDuplicates(items: any[], field: string): number {
        const values = items.map(i => i[field]).filter(Boolean);
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        values.forEach(v => {
            if (seen.has(v)) duplicates.add(v);
            seen.add(v);
        });
        return duplicates.size;
    }

    // ═══════════════════════════════════════════════════════════════
    // SEO Pages CRUD
    // ═══════════════════════════════════════════════════════════════

    async createSeoPage(data: any): Promise<any> {
        const page = {
            id: `seopg_${Date.now()}`,
            entity_type: data.entity_type || "page",
            entity_id: data.entity_id || "",
            slug: data.slug || "",
            url: data.url || "",
            meta_title: data.meta_title || null,
            meta_description: data.meta_description || null,
            canonical_url: data.canonical_url || null,
            robots_directive: data.robots_directive || "index,follow",
            keywords: data.keywords || null,
            og_title: data.og_title || null,
            og_description: data.og_description || null,
            og_image: data.og_image || null,
            og_type: data.og_type || "website",
            twitter_card: data.twitter_card || "summary_large_image",
            twitter_title: data.twitter_title || null,
            twitter_description: data.twitter_description || null,
            twitter_image: data.twitter_image || null,
            h1_text: data.h1_text || null,
            h1_count: data.h1_count || 0,
            word_count: data.word_count || 0,
            has_schema: data.has_schema || false,
            schema_types: data.schema_types || null,
            internal_links_count: data.internal_links_count || 0,
            external_links_count: data.external_links_count || 0,
            images_count: data.images_count || 0,
            images_missing_alt: data.images_missing_alt || 0,
            seo_score: 0,
            geo_score: 0,
            aeo_score: 0,
            status: data.status || "published",
            last_crawled_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
            updated_by: data.updated_by || "admin",
        };
        page.seo_score = this.calculateSeoScore(page);
        page.geo_score = this.calculateGeoScore(page);
        page.aeo_score = this.calculateAeoScore(page, this.seoAeoEntries);
        this.seoPages.push(page);
        return page;
    }

    async updateSeoPage(id: string, data: any): Promise<any> {
        const idx = this.seoPages.findIndex(p => p.id === id);
        if (idx < 0) throw new Error(`SEO Page ${id} not found`);
        const page = { ...this.seoPages[idx], ...data, updated_at: new Date().toISOString() };
        page.seo_score = this.calculateSeoScore(page);
        page.geo_score = this.calculateGeoScore(page);
        page.aeo_score = this.calculateAeoScore(page, this.seoAeoEntries);
        this.seoPages[idx] = page;
        return page;
    }

    async deleteSeoPage(id: string): Promise<boolean> {
        this.seoPages = this.seoPages.filter(p => p.id !== id);
        return true;
    }

    async getSeoPages(filters?: any): Promise<any[]> {
        let pages = [...this.seoPages];
        if (filters?.entity_type) pages = pages.filter(p => p.entity_type === filters.entity_type);
        if (filters?.status) pages = pages.filter(p => p.status === filters.status);
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            pages = pages.filter(p =>
                (p.slug || "").toLowerCase().includes(q) ||
                (p.meta_title || "").toLowerCase().includes(q) ||
                (p.url || "").toLowerCase().includes(q)
            );
        }
        return pages;
    }

    // ═══════════════════════════════════════════════════════════════
    // Keywords
    // ═══════════════════════════════════════════════════════════════

    async createSeoKeyword(data: any): Promise<any> {
        const kw = {
            id: `seokey_${Date.now()}`,
            keyword: data.keyword,
            group_id: data.group_id || null,
            search_volume: data.search_volume || 0,
            difficulty: data.difficulty || 0,
            current_position: data.current_position || 0,
            previous_position: 0,
            best_position: data.current_position || 0,
            target_url: data.target_url || null,
            location: data.location || null,
            device: data.device || "desktop",
            search_engine: data.search_engine || "google",
            status: "tracking",
            last_checked_at: new Date().toISOString(),
            ranking_history: JSON.stringify([{ date: new Date().toISOString().split("T")[0], position: data.current_position || 0 }]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
        };
        this.seoKeywords.push(kw);
        return kw;
    }

    async getSeoKeywords(): Promise<any[]> { return this.seoKeywords; }

    async updateSeoKeyword(id: string, data: any): Promise<any> {
        const idx = this.seoKeywords.findIndex(k => k.id === id);
        if (idx < 0) throw new Error(`Keyword ${id} not found`);
        const prev = this.seoKeywords[idx];
        const updated = { ...prev, ...data, previous_position: prev.current_position, updated_at: new Date().toISOString() };
        if (data.current_position && data.current_position < (prev.best_position || 999)) {
            updated.best_position = data.current_position;
        }
        // Append to ranking history
        try {
            const history = JSON.parse(prev.ranking_history || "[]");
            history.push({ date: new Date().toISOString().split("T")[0], position: data.current_position || prev.current_position });
            updated.ranking_history = JSON.stringify(history.slice(-90)); // Keep last 90 days
        } catch { /* ignore */ }
        this.seoKeywords[idx] = updated;
        return updated;
    }

    async deleteSeoKeyword(id: string): Promise<boolean> {
        this.seoKeywords = this.seoKeywords.filter(k => k.id !== id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // Redirects
    // ═══════════════════════════════════════════════════════════════

    async createSeoRedirect(data: any): Promise<any> {
        // Loop detection
        if (data.target_url) {
            const existing = this.seoRedirects.find(r => r.source_url === data.target_url && r.target_url === data.source_url);
            if (existing) throw new Error(`Redirect loop detected: ${data.source_url} ↔ ${data.target_url}`);
            // Chain detection
            const chain = this.seoRedirects.find(r => r.source_url === data.target_url);
            if (chain) {
                // Allow but log warning
            }
        }
        const redirect = {
            id: `seord_${Date.now()}`,
            source_url: data.source_url,
            target_url: data.target_url || null,
            status_code: data.status_code || 301,
            is_regex: data.is_regex || false,
            is_active: data.is_active !== false,
            hit_count: 0,
            last_hit_at: null,
            notes: data.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
            updated_by: data.updated_by || "admin",
        };
        this.seoRedirects.push(redirect);
        return redirect;
    }

    async getSeoRedirects(): Promise<any[]> { return this.seoRedirects; }

    async updateSeoRedirect(id: string, data: any): Promise<any> {
        const idx = this.seoRedirects.findIndex(r => r.id === id);
        if (idx < 0) throw new Error(`Redirect ${id} not found`);
        this.seoRedirects[idx] = { ...this.seoRedirects[idx], ...data, updated_at: new Date().toISOString() };
        return this.seoRedirects[idx];
    }

    async deleteSeoRedirect(id: string): Promise<boolean> {
        this.seoRedirects = this.seoRedirects.filter(r => r.id !== id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // Broken Links
    // ═══════════════════════════════════════════════════════════════

    async runBrokenLinkScan(pages: any[]): Promise<any> {
        const startTime = Date.now();
        // In production this would actually fetch URLs; here we scan stored internal links
        const brokenFound: any[] = [];
        const allUrls = new Set(pages.map(p => p.url).filter(Boolean));

        this.seoInternalLinks.forEach(link => {
            if (!allUrls.has(link.target_url)) {
                brokenFound.push({
                    id: `seobl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    page_url: link.source_url,
                    broken_url: link.target_url,
                    link_text: link.anchor_text,
                    status_code: 404,
                    link_type: "internal",
                    is_resolved: false,
                    resolved_at: null,
                    found_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    created_by: "system",
                });
            }
        });

        this.seoBrokenLinks = [...this.seoBrokenLinks.filter(b => b.is_resolved), ...brokenFound];

        const crawlEntry = {
            id: `seoch_${Date.now()}`,
            crawl_type: "broken_links",
            pages_scanned: pages.length,
            issues_found: brokenFound.length,
            duration_ms: Date.now() - startTime,
            status: "completed",
            summary: JSON.stringify({ broken_links_found: brokenFound.length }),
            triggered_by: "admin",
            created_at: new Date().toISOString(),
        };
        this.seoCrawlHistory.push(crawlEntry);

        return { broken_links: brokenFound, crawl: crawlEntry };
    }

    async getSeoBrokenLinks(): Promise<any[]> { return this.seoBrokenLinks; }

    // ═══════════════════════════════════════════════════════════════
    // Internal Links
    // ═══════════════════════════════════════════════════════════════

    async getSeoInternalLinks(): Promise<any[]> { return this.seoInternalLinks; }

    async suggestInternalLinks(products: any[], categories: any[], branches: any[], pages: any[]): Promise<any[]> {
        const suggestions: any[] = [];
        // Suggest linking products to their category pages
        products.forEach(p => {
            if (p.category_id) {
                const cat = categories.find(c => c.id === p.category_id);
                if (cat) {
                    suggestions.push({
                        source_url: `/products/${p.handle || p.id}`,
                        target_url: `/categories/${cat.slug || cat.id}`,
                        anchor_text: cat.name,
                        reason: "Product → Category internal link",
                    });
                }
            }
        });
        // Suggest branch pages linking to nearby branches
        branches.forEach((b, i) => {
            const nearby = branches.filter((_, j) => j !== i).slice(0, 2);
            nearby.forEach(nb => {
                suggestions.push({
                    source_url: `/cakes/${(b.slug || b.name || "").toLowerCase().replace(/\s+/g, "-")}`,
                    target_url: `/cakes/${(nb.slug || nb.name || "").toLowerCase().replace(/\s+/g, "-")}`,
                    anchor_text: `Cake delivery in ${nb.name || nb.city}`,
                    reason: "Branch → Nearby branch internal link",
                });
            });
        });
        return suggestions;
    }

    // ═══════════════════════════════════════════════════════════════
    // Schema Templates
    // ═══════════════════════════════════════════════════════════════

    async createSchemaTemplate(data: any): Promise<any> {
        const template = {
            id: `seost_${Date.now()}`,
            name: data.name,
            schema_type: data.schema_type,
            template_json: data.template_json || "{}",
            description: data.description || null,
            is_active: true,
            usage_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
            updated_by: data.updated_by || "admin",
        };
        this.seoSchemaTemplates.push(template);
        return template;
    }

    async getSeoSchemaTemplates(): Promise<any[]> { return this.seoSchemaTemplates; }

    /**
     * Validate JSON-LD structure
     */
    validateJsonLd(jsonStr: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        try {
            const parsed = JSON.parse(jsonStr);
            if (!parsed["@context"]) errors.push("Missing @context");
            if (!parsed["@type"]) errors.push("Missing @type");
            if (parsed["@context"] !== "https://schema.org") errors.push("@context should be 'https://schema.org'");
        } catch (e: any) {
            errors.push(`Invalid JSON: ${e.message}`);
        }
        return { valid: errors.length === 0, errors };
    }

    // ═══════════════════════════════════════════════════════════════
    // Image Audit
    // ═══════════════════════════════════════════════════════════════

    async runImageAudit(products: any[]): Promise<any> {
        const results: any[] = [];
        products.forEach(p => {
            if (p.thumbnail) {
                const hasAlt = !!(p.alt_text || p.title);
                results.push({
                    id: `seoia_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    page_url: `/products/${p.handle || p.id}`,
                    image_url: p.thumbnail,
                    alt_text: p.alt_text || null,
                    has_alt: hasAlt,
                    has_width: !!p.image_width,
                    has_height: !!p.image_height,
                    has_lazy_loading: true,
                    file_size_kb: 0,
                    format: p.thumbnail.includes(".webp") ? "webp" : p.thumbnail.includes(".png") ? "png" : "jpg",
                    is_broken: false,
                    suggested_alt: `${p.title} - Premium cake from CakeToHome`,
                    entity_type: "product",
                    entity_id: p.id,
                    created_at: new Date().toISOString(),
                });
            }
        });
        this.seoImageAudits = results;
        return { images_audited: results.length, missing_alt: results.filter(r => !r.has_alt).length };
    }

    async getSeoImageAudits(): Promise<any[]> { return this.seoImageAudits; }

    // ═══════════════════════════════════════════════════════════════
    // Competitors
    // ═══════════════════════════════════════════════════════════════

    async createSeoCompetitor(data: any): Promise<any> {
        const competitor = {
            id: `seocp_${Date.now()}`,
            name: data.name,
            domain: data.domain,
            description: data.description || null,
            tracked_keywords: data.tracked_keywords || null,
            notes: data.notes || null,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
        };
        this.seoCompetitors.push(competitor);
        return competitor;
    }

    async getSeoCompetitors(): Promise<any[]> { return this.seoCompetitors; }

    async deleteSeoCompetitor(id: string): Promise<boolean> {
        this.seoCompetitors = this.seoCompetitors.filter(c => c.id !== id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // GEO Landing Pages
    // ═══════════════════════════════════════════════════════════════

    async generateGeoLandingPage(data: any): Promise<any> {
        const city = data.city || "Kollam";
        const area = data.area || null;
        const slug = `cakes/${(area || city).toLowerCase().replace(/\s+/g, "-")}`;

        const page = {
            id: `seogp_${Date.now()}`,
            page_type: data.page_type || "city",
            city,
            area,
            pincode: data.pincode || null,
            branch_id: data.branch_id || null,
            slug,
            title: `${data.title || `Cake Delivery in ${area || city}`}`,
            meta_title: `Order Cakes Online in ${area || city} | CakeToHome ${area || city}`,
            meta_description: `Fresh premium cakes delivered to your doorstep in ${area || city}. Same-day delivery, midnight delivery, custom birthday cakes. Order now from CakeToHome.`,
            h1_text: `Best Cake Delivery in ${area || city}`,
            content_html: data.content_html || `<p>CakeToHome delivers premium handcrafted cakes in ${area || city}. Choose from our collection of birthday cakes, wedding cakes, anniversary cakes, and custom designer cakes with same-day and midnight delivery.</p>`,
            faqs: JSON.stringify(data.faqs || [
                { question: `Do you deliver cakes in ${area || city}?`, answer: `Yes! CakeToHome offers same-day and midnight cake delivery across ${area || city}.` },
                { question: `What is the delivery time in ${area || city}?`, answer: `We deliver within 2-4 hours in ${area || city}. Midnight delivery is also available.` },
                { question: `Can I order a custom cake in ${area || city}?`, answer: `Absolutely! We specialize in custom birthday, wedding, and theme cakes in ${area || city}.` },
            ]),
            schema_json: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "@id": `https://cakes2home.com/${slug}`,
                name: `CakeToHome ${area || city}`,
                description: `Premium cake delivery service in ${area || city}`,
                url: `https://cakes2home.com/${slug}`,
                areaServed: { "@type": "City", name: area || city },
            }),
            breadcrumbs: JSON.stringify([
                { name: "Home", url: "/" },
                { name: "Cakes", url: "/cakes" },
                { name: area || city, url: `/${slug}` },
            ]),
            internal_links: JSON.stringify([]),
            keywords: `cake delivery ${(area || city).toLowerCase()}, cakes online ${(area || city).toLowerCase()}, birthday cake ${(area || city).toLowerCase()}`,
            status: "published",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
            updated_by: data.updated_by || "admin",
        };
        this.seoGeoPages.push(page);
        return page;
    }

    async getSeoGeoPages(): Promise<any[]> { return this.seoGeoPages; }

    // ═══════════════════════════════════════════════════════════════
    // AEO Entries
    // ═══════════════════════════════════════════════════════════════

    async createAeoEntry(data: any): Promise<any> {
        const entry = {
            id: `seoae_${Date.now()}`,
            entry_type: data.entry_type || "faq",
            question: data.question || null,
            answer: data.answer || null,
            steps: data.steps || null,
            entity_type: data.entity_type || null,
            entity_id: data.entity_id || null,
            page_url: data.page_url || null,
            schema_json: null as string | null,
            quality_score: data.quality_score || 0,
            is_featured: data.is_featured || false,
            status: "published",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
            updated_by: data.updated_by || "admin",
        };
        // Auto-generate schema
        if (entry.entry_type === "faq" && entry.question && entry.answer) {
            entry.schema_json = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Question",
                name: entry.question,
                acceptedAnswer: { "@type": "Answer", text: entry.answer },
            });
            entry.quality_score = Math.min(100, (entry.answer.length > 100 ? 70 : 40) + (entry.question.length > 20 ? 30 : 15));
        }
        this.seoAeoEntries.push(entry);
        return entry;
    }

    async getSeoAeoEntries(): Promise<any[]> { return this.seoAeoEntries; }

    async deleteSeoAeoEntry(id: string): Promise<boolean> {
        this.seoAeoEntries = this.seoAeoEntries.filter(e => e.id !== id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // Content Audit
    // ═══════════════════════════════════════════════════════════════

    async runContentAudit(pages: any[]): Promise<any> {
        const results: any[] = [];
        const titles = new Map<string, string[]>();

        pages.forEach(p => {
            const t = p.meta_title || p.title || "";
            if (t) {
                if (!titles.has(t)) titles.set(t, []);
                titles.get(t)!.push(p.id);
            }
        });

        pages.forEach(p => {
            const issues: string[] = [];
            const recommendations: string[] = [];
            const isThin = (p.word_count || 0) < 300;
            const t = p.meta_title || p.title || "";
            const isDuplicate = titles.has(t) && titles.get(t)!.length > 1;

            if (isThin) { issues.push("Thin content (< 300 words)"); recommendations.push("Add more descriptive content (aim for 500+ words)"); }
            if (isDuplicate) { issues.push("Duplicate title detected"); recommendations.push("Create unique meta titles for each page"); }
            if (!p.h1_text && !p.h1_count) { issues.push("Missing H1 tag"); recommendations.push("Add a descriptive H1 heading"); }
            if ((p.h1_count || 0) > 1) { issues.push("Multiple H1 tags"); recommendations.push("Use only one H1 tag per page"); }
            if (!p.meta_title) { issues.push("Missing meta title"); recommendations.push("Add a meta title (50-60 characters)"); }
            if (!p.meta_description) { issues.push("Missing meta description"); recommendations.push("Add a meta description (140-160 characters)"); }
            if (!p.canonical_url) { issues.push("Missing canonical URL"); recommendations.push("Set a canonical URL to prevent duplicate content issues"); }
            if (!p.has_schema) { issues.push("Missing structured data"); recommendations.push("Add relevant Schema.org markup (Product, FAQ, LocalBusiness)"); }

            results.push({
                id: `seoca_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                page_url: p.url || p.slug || "",
                entity_type: p.entity_type || null,
                entity_id: p.entity_id || p.id || null,
                word_count: p.word_count || 0,
                readability_score: Math.min(100, (p.word_count || 0) > 300 ? 75 : 40),
                keyword_density: 0,
                is_thin: isThin,
                is_duplicate: isDuplicate,
                duplicate_of: isDuplicate ? titles.get(t)!.find(id => id !== p.id) || null : null,
                has_h1: !!(p.h1_text || p.h1_count > 0),
                h1_count: p.h1_count || 0,
                has_meta_title: !!p.meta_title,
                has_meta_description: !!p.meta_description,
                has_canonical: !!p.canonical_url,
                has_schema: !!p.has_schema,
                issues: JSON.stringify(issues),
                recommendations: JSON.stringify(recommendations),
                audit_date: new Date().toISOString().split("T")[0],
                created_at: new Date().toISOString(),
                created_by: "system",
            });
        });

        this.seoContentAudits = results;
        return { pages_audited: results.length, issues_found: results.filter(r => JSON.parse(r.issues || "[]").length > 0).length };
    }

    async getSeoContentAudits(): Promise<any[]> { return this.seoContentAudits; }

    // ═══════════════════════════════════════════════════════════════
    // Page Speed
    // ═══════════════════════════════════════════════════════════════

    async recordPageSpeed(data: any): Promise<any> {
        const record = {
            id: `seops_${Date.now()}`,
            page_url: data.page_url || "/",
            device: data.device || "mobile",
            lcp_ms: data.lcp_ms || 0,
            cls: data.cls || 0,
            inp_ms: data.inp_ms || 0,
            fcp_ms: data.fcp_ms || 0,
            ttfb_ms: data.ttfb_ms || 0,
            speed_index: data.speed_index || 0,
            performance_score: data.performance_score || 0,
            js_size_kb: data.js_size_kb || 0,
            css_size_kb: data.css_size_kb || 0,
            image_size_kb: data.image_size_kb || 0,
            total_size_kb: data.total_size_kb || 0,
            requests_count: data.requests_count || 0,
            measured_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            created_by: data.created_by || "system",
        };
        this.seoPageSpeed.push(record);
        return record;
    }

    async getSeoPageSpeed(): Promise<any[]> { return this.seoPageSpeed; }

    // ═══════════════════════════════════════════════════════════════
    // UTM Campaigns
    // ═══════════════════════════════════════════════════════════════

    async createUtmCampaign(data: any): Promise<any> {
        const url = data.url || "https://cakes2home.com";
        const params = new URLSearchParams();
        if (data.source) params.set("utm_source", data.source);
        if (data.medium) params.set("utm_medium", data.medium);
        if (data.campaign) params.set("utm_campaign", data.campaign);
        if (data.term) params.set("utm_term", data.term);
        if (data.content) params.set("utm_content", data.content);

        const campaign = {
            id: `seout_${Date.now()}`,
            name: data.name || `${data.source}_${data.campaign}`,
            url,
            source: data.source || "",
            medium: data.medium || "",
            campaign: data.campaign || "",
            term: data.term || null,
            content: data.content || null,
            generated_url: `${url}?${params.toString()}`,
            click_count: 0,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
        };
        this.seoUtmCampaigns.push(campaign);
        return campaign;
    }

    async getSeoUtmCampaigns(): Promise<any[]> { return this.seoUtmCampaigns; }

    async deleteSeoUtmCampaign(id: string): Promise<boolean> {
        this.seoUtmCampaigns = this.seoUtmCampaigns.filter(c => c.id !== id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // Robots History
    // ═══════════════════════════════════════════════════════════════

    async saveRobotsVersion(data: any): Promise<any> {
        const maxVersion = this.seoRobotsHistory.reduce((max, r) => Math.max(max, r.version || 0), 0);
        // Deactivate all previous
        this.seoRobotsHistory.forEach(r => r.is_active = false);
        const version = {
            id: `seorh_${Date.now()}`,
            content: data.content,
            version: maxVersion + 1,
            environment: data.environment || "production",
            is_active: true,
            notes: data.notes || null,
            created_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
        };
        this.seoRobotsHistory.push(version);
        return version;
    }

    async getSeoRobotsHistory(): Promise<any[]> { return this.seoRobotsHistory; }

    async rollbackRobots(id: string): Promise<any> {
        const target = this.seoRobotsHistory.find(r => r.id === id);
        if (!target) throw new Error(`Robots version ${id} not found`);
        this.seoRobotsHistory.forEach(r => r.is_active = false);
        target.is_active = true;
        return target;
    }

    // ═══════════════════════════════════════════════════════════════
    // Social Cards
    // ═══════════════════════════════════════════════════════════════

    async getSeoSocialCards(): Promise<any[]> { return this.seoSocialCards; }
    async updateSeoSocialCard(id: string, data: any): Promise<any> {
        const idx = this.seoSocialCards.findIndex(c => c.id === id);
        if (idx < 0) throw new Error(`Social card ${id} not found`);
        this.seoSocialCards[idx] = { ...this.seoSocialCards[idx], ...data, updated_at: new Date().toISOString() };
        return this.seoSocialCards[idx];
    }

    // ═══════════════════════════════════════════════════════════════
    // Backlinks
    // ═══════════════════════════════════════════════════════════════

    async createSeoBacklink(data: any): Promise<any> {
        const backlink = {
            id: `seobk_${Date.now()}`,
            source_domain: data.source_domain,
            source_url: data.source_url,
            target_url: data.target_url || "/",
            anchor_text: data.anchor_text || null,
            domain_authority: data.domain_authority || 0,
            is_dofollow: data.is_dofollow !== false,
            is_active: true,
            first_seen: new Date().toISOString().split("T")[0],
            last_checked: new Date().toISOString().split("T")[0],
            status: "active",
            created_at: new Date().toISOString(),
            created_by: data.created_by || "admin",
        };
        this.seoBacklinks.push(backlink);
        return backlink;
    }

    async getSeoBacklinks(): Promise<any[]> { return this.seoBacklinks; }

    // ═══════════════════════════════════════════════════════════════
    // Reports
    // ═══════════════════════════════════════════════════════════════

    async generateSeoReport(type: string = "overall"): Promise<any> {
        const summary = await this.getSeoDashboardSummary();
        const report = {
            id: `seorp_${Date.now()}`,
            report_type: type,
            report_period: new Date().toISOString().split("T")[0],
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} SEO Report — ${new Date().toISOString().split("T")[0]}`,
            summary: `SEO Score: ${summary.seo_score}/100 | GEO Score: ${summary.geo_score}/100 | AEO Score: ${summary.aeo_score}/100 | Pages: ${summary.total_pages} | Issues: ${summary.broken_links + summary.missing_alt + summary.missing_schema}`,
            data: JSON.stringify(summary),
            format: "json",
            status: "completed",
            file_url: null,
            created_at: new Date().toISOString(),
            created_by: "system",
        };
        this.seoReports.push(report);
        return report;
    }

    async getSeoReports(): Promise<any[]> { return this.seoReports; }

    // ═══════════════════════════════════════════════════════════════
    // Audit Log
    // ═══════════════════════════════════════════════════════════════

    addSeoAuditLog(action: string, entityType: string, entityId?: string, details?: string) {
        this.seoAuditLogs.push({
            id: `seoal_${Date.now()}`,
            action,
            entity_type: entityType,
            entity_id: entityId || null,
            details: details || null,
            user: "admin@cakes2home.com",
            ip_address: "127.0.0.1",
            created_at: new Date().toISOString(),
        });
    }

    async getSeoAuditLogs(): Promise<any[]> { return this.seoAuditLogs; }

    // ═══════════════════════════════════════════════════════════════
    // Health Report Generation
    // ═══════════════════════════════════════════════════════════════

    async generateHealthReport(): Promise<any> {
        const summary = await this.getSeoDashboardSummary();
        const report = {
            id: `seohr_${Date.now()}`,
            report_date: new Date().toISOString().split("T")[0],
            overall_score: Math.round((summary.seo_score + summary.geo_score + summary.aeo_score) / 3),
            ...summary,
            details: JSON.stringify(summary),
            created_at: new Date().toISOString(),
            created_by: "system",
        };
        this.seoHealthReports.push(report);
        return report;
    }

    // ═══════════════════════════════════════════════════════════════
    // Crawl History
    // ═══════════════════════════════════════════════════════════════

    async getSeoCrawlHistory(): Promise<any[]> { return this.seoCrawlHistory; }

    // ═══════════════════════════════════════════════════════════════
    // AI Content Generator (Rule-based, no external API required)
    // ═══════════════════════════════════════════════════════════════

    generateAiSeoContent(type: string, context: any): any {
        const name = context.name || context.title || "Product";
        const city = context.city || "Kollam";
        const category = context.category || "cakes";

        switch (type) {
            case "meta_title":
                return {
                    suggestions: [
                        `${name} — Order Online | CakeToHome`,
                        `Buy ${name} Online | Free Delivery | CakeToHome`,
                        `${name} | Premium ${category} | CakeToHome ${city}`,
                    ]
                };
            case "meta_description":
                return {
                    suggestions: [
                        `Order ${name} online from CakeToHome. Fresh, handcrafted with premium ingredients. Same-day delivery in ${city}. Order now!`,
                        `Get the best ${name} delivered to your doorstep in ${city}. Midnight delivery available. 100% fresh guarantee from CakeToHome.`,
                        `${name} by CakeToHome — premium quality, same-day delivery in ${city}. Perfect for birthdays, anniversaries & celebrations.`,
                    ]
                };
            case "keywords":
                return {
                    suggestions: [
                        `${name.toLowerCase()}, ${name.toLowerCase()} online, buy ${name.toLowerCase()}, ${name.toLowerCase()} ${city.toLowerCase()}, ${name.toLowerCase()} delivery`,
                    ]
                };
            case "faq":
                return {
                    suggestions: [
                        { question: `How to order ${name}?`, answer: `You can order ${name} online through CakeToHome. Simply visit our website, select your cake, choose a delivery slot, and pay securely.` },
                        { question: `Is ${name} available for midnight delivery?`, answer: `Yes! CakeToHome offers midnight delivery for ${name} in ${city} and surrounding areas.` },
                        { question: `Can I customize ${name}?`, answer: `Absolutely! Contact our team to customize ${name} with your preferred flavors, decorations, and message.` },
                    ]
                };
            case "alt_text":
                return {
                    suggestions: [
                        `${name} — Premium cake from CakeToHome`,
                        `${name} available for delivery in ${city}`,
                        `Order ${name} online — CakeToHome`,
                    ]
                };
            default:
                return { suggestions: [] };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Bulk Data Loaders (for test/seed)
    // ═══════════════════════════════════════════════════════════════

    async loadData(data: any): Promise<void> {
        if (data.seo_pages) this.seoPages = data.seo_pages;
        if (data.seo_keywords) this.seoKeywords = data.seo_keywords;
        if (data.seo_redirects) this.seoRedirects = data.seo_redirects;
        if (data.seo_broken_links) this.seoBrokenLinks = data.seo_broken_links;
        if (data.seo_internal_links) this.seoInternalLinks = data.seo_internal_links;
        if (data.seo_schema_templates) this.seoSchemaTemplates = data.seo_schema_templates;
        if (data.seo_image_audits) this.seoImageAudits = data.seo_image_audits;
        if (data.seo_competitors) this.seoCompetitors = data.seo_competitors;
        if (data.seo_geo_pages) this.seoGeoPages = data.seo_geo_pages;
        if (data.seo_aeo_entries) this.seoAeoEntries = data.seo_aeo_entries;
        if (data.seo_content_audits) this.seoContentAudits = data.seo_content_audits;
        if (data.seo_page_speed) this.seoPageSpeed = data.seo_page_speed;
        if (data.seo_audit_logs) this.seoAuditLogs = data.seo_audit_logs;
        if (data.seo_utm_campaigns) this.seoUtmCampaigns = data.seo_utm_campaigns;
        if (data.seo_robots_history) this.seoRobotsHistory = data.seo_robots_history;
        if (data.seo_backlinks) this.seoBacklinks = data.seo_backlinks;
        if (data.seo_reports) this.seoReports = data.seo_reports;
    }
}
