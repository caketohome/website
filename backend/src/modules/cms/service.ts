import { MedusaService } from "@medusajs/utils";
import {
    CmsPage,
    CmsCategory,
    CmsTag,
    CmsBlock,
    CmsHomepageSection,
    CmsBanner,
    CmsNavigation,
    CmsRedirect,
    CmsTemplate,
    CmsRevision,
    CmsAssetReference,
} from "./models";
import type {
    CmsPageInput,
    HomepageSectionInput,
    BannerInput,
    NavigationInput,
    RedirectInput,
} from "./types/common";

function stringifyJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function parseJsonField<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
    return raw as T;
}

/**
 * CMS module service — the single content platform for CakeToHome.
 *
 * Powers pages, blog, landing pages, homepage builder, navigation,
 * banners, redirects, templates, and revision history. All content is
 * admin-editable, localizable, schedulable, and SEO-managed.
 *
 * Integration points:
 *   - Settings Module (M1): feature flags (cms, blog, homepage_builder, seo, dynamic_navigation)
 *   - Analytics Module (M5): page views, banner clicks, nav clicks, blog reads
 *   - Media Module (M10): asset references
 *   - Localization Module (M11): language_code on every entity
 *   - Audit Module: logs content changes
 */
class CmsModuleService extends MedusaService({
    CmsPage,
    CmsCategory,
    CmsTag,
    CmsBlock,
    CmsHomepageSection,
    CmsBanner,
    CmsNavigation,
    CmsRedirect,
    CmsTemplate,
    CmsRevision,
    CmsAssetReference,
}) {
    // ── Pages ────────────────────────────────────────────────────────────

    async createPage(input: CmsPageInput) {
        return this.createCmsPages({
            slug: slugify(input.slug),
            title: input.title,
            type: input.type ?? "page",
            status: input.status ?? "draft",
            blocks: stringifyJson(input.blocks),
            meta_title: input.meta_title ?? null,
            meta_description: input.meta_description ?? null,
            canonical_url: input.canonical_url ?? null,
            og_image: input.og_image ?? null,
            author: input.author ?? null,
            excerpt: input.excerpt ?? null,
            featured_image: input.featured_image ?? null,
            reading_time: input.reading_time ?? 0,
            published_at: input.published_at ?? null,
            language_code: input.language_code ?? "en",
            template_id: input.template_id ?? null,
            category_id: input.category_id ?? null,
        });
    }

    async updatePage(id: string, input: Partial<CmsPageInput>) {
        const data: Record<string, unknown> = {};
        if (input.slug !== undefined) data.slug = slugify(input.slug);
        if (input.title !== undefined) data.title = input.title;
        if (input.type !== undefined) data.type = input.type;
        if (input.status !== undefined) data.status = input.status;
        if (input.blocks !== undefined) data.blocks = stringifyJson(input.blocks);
        if (input.meta_title !== undefined) data.meta_title = input.meta_title;
        if (input.meta_description !== undefined) data.meta_description = input.meta_description;
        if (input.canonical_url !== undefined) data.canonical_url = input.canonical_url;
        if (input.og_image !== undefined) data.og_image = input.og_image;
        if (input.author !== undefined) data.author = input.author;
        if (input.excerpt !== undefined) data.excerpt = input.excerpt;
        if (input.featured_image !== undefined) data.featured_image = input.featured_image;
        if (input.reading_time !== undefined) data.reading_time = input.reading_time;
        if (input.published_at !== undefined) data.published_at = input.published_at;
        if (input.language_code !== undefined) data.language_code = input.language_code;
        if (input.template_id !== undefined) data.template_id = input.template_id;
        if (input.category_id !== undefined) data.category_id = input.category_id;

        return this.updateCmsPages({ selector: { id }, data });
    }

    /**
     * Publish a page: set status=published, published_at=now, and create a revision snapshot.
     */
    async publishPage(id: string, author?: string | null) {
        const [page] = (await this.listCmsPages({ id })) as unknown as Record<string, unknown>[];
        if (!page) return null;

        const now = new Date();
        await this.updateCmsPages({
            selector: { id },
            data: { status: "published", published_at: now },
        });

        await this.createRevision(id, page, author);
        return { id, status: "published", published_at: now };
    }

    async archivePage(id: string) {
        return this.updateCmsPages({
            selector: { id },
            data: { status: "archived", archived_at: new Date() },
        });
    }

    /**
     * Duplicate an existing CMS page as a draft copy.
     */
    async duplicatePage(id: string) {
        const [page] = (await this.listCmsPages({ id })) as unknown as Record<string, unknown>[];
        if (!page) return null;

        const newSlug = `${page.slug as string}-copy-${Date.now().toString(36)}`;
        const newTitle = `${page.title as string} (Copy)`;

        return this.createCmsPages({
            ...page,
            id: undefined,
            slug: newSlug,
            title: newTitle,
            status: "draft",
            published_at: null,
            created_at: undefined,
            updated_at: undefined,
        });
    }

    /**
     * Rollback a page snapshot to a specific version number from CmsRevision history.
     */
    async rollbackRevision(pageId: string, version: number) {
        const revisions = (await this.listCmsRevisions({
            page_id: pageId,
            version,
        })) as unknown as Record<string, unknown>[];

        if (revisions.length === 0) return null;
        const rev = revisions[0];
        const snapshot = parseJsonField<Record<string, unknown>>(rev.snapshot);
        if (!snapshot) return null;

        await this.updateCmsPages({
            selector: { id: pageId },
            data: {
                title: snapshot.title,
                slug: snapshot.slug,
                blocks: stringifyJson(snapshot.blocks),
                meta_title: snapshot.meta_title,
                meta_description: snapshot.meta_description,
                canonical_url: snapshot.canonical_url,
                og_image: snapshot.og_image,
                status: "draft",
            },
        });

        return { id: pageId, version, restored: true };
    }

    /**
     * Resolve a published page by slug + language for the storefront.
     */
    async getPublishedPage(slug: string, languageCode = "en") {
        const pages = (await this.listCmsPages({
            slug,
            status: "published",
            language_code: languageCode,
        })) as unknown as Record<string, unknown>[];

        if (pages.length === 0) return null;
        const page = pages[0];
        // Filter out scheduled-future pages.
        const publishedAt = page.published_at as Date | null;
        if (publishedAt && publishedAt.getTime() > Date.now()) return null;

        return {
            ...page,
            blocks: parseJsonField<unknown[]>(page.blocks),
        };
    }

    /**
     * List published blog posts with optional category filter.
     */
    async listPublishedBlogPosts(opts: {
        languageCode?: string;
        categoryId?: string;
        limit?: number;
        offset?: number;
    } = {}) {
        const filters: Record<string, unknown> = {
            type: "blog",
            status: "published",
            language_code: opts.languageCode ?? "en",
        };
        if (opts.categoryId) filters.category_id = opts.categoryId;

        const posts = (await this.listCmsPages(filters)) as unknown as Record<string, unknown>[];

        const now = Date.now();
        return posts
            .filter((p) => {
                const publishedAt = p.published_at as Date | null;
                return !publishedAt || publishedAt.getTime() <= now;
            })
            .map((p) => ({ ...p, blocks: parseJsonField<unknown[]>(p.blocks) }))
            .slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 20));
    }

    // ── Revisions ────────────────────────────────────────────────────────

    async createRevision(pageId: string, snapshot: Record<string, unknown>, author?: string | null) {
        const revisions = (await this.listCmsRevisions({ page_id: pageId })) as unknown as Record<
            string,
            unknown
        >[];
        const version = revisions.length + 1;
        return this.createCmsRevisions({
            page_id: pageId,
            version,
            snapshot: stringifyJson(snapshot),
            author: author ?? null,
        });
    }

    async listRevisions(pageId: string) {
        return this.listCmsRevisions({ page_id: pageId });
    }

    // ── Homepage sections ─────────────────────────────────────────────────

    async createHomepageSection(input: HomepageSectionInput) {
        return this.createCmsHomepageSections({
            name: input.name,
            section_type: input.section_type,
            title: input.title ?? null,
            subtitle: input.subtitle ?? null,
            config: stringifyJson(input.config),
            sort_order: input.sort_order ?? 0,
            is_active: input.is_active ?? true,
            starts_at: input.starts_at ?? null,
            ends_at: input.ends_at ?? null,
            visibility: stringifyJson(input.visibility),
            theme: stringifyJson(input.theme),
            language_code: input.language_code ?? "en",
        });
    }

    async updateHomepageSection(id: string, input: Partial<HomepageSectionInput>) {
        const data: Record<string, unknown> = {};
        if (input.name !== undefined) data.name = input.name;
        if (input.section_type !== undefined) data.section_type = input.section_type;
        if (input.title !== undefined) data.title = input.title;
        if (input.subtitle !== undefined) data.subtitle = input.subtitle;
        if (input.config !== undefined) data.config = stringifyJson(input.config);
        if (input.sort_order !== undefined) data.sort_order = input.sort_order;
        if (input.is_active !== undefined) data.is_active = input.is_active;
        if (input.starts_at !== undefined) data.starts_at = input.starts_at;
        if (input.ends_at !== undefined) data.ends_at = input.ends_at;
        if (input.visibility !== undefined) data.visibility = stringifyJson(input.visibility);
        if (input.theme !== undefined) data.theme = stringifyJson(input.theme);
        if (input.language_code !== undefined) data.language_code = input.language_code;
        return this.updateCmsHomepageSections({ selector: { id }, data });
    }

    /**
     * Get active homepage sections for the storefront, sorted, with scheduling applied.
     */
    async getHomepageSections(languageCode = "en") {
        const sections = (await this.listCmsHomepageSections({
            is_active: true,
            language_code: languageCode,
        })) as unknown as Record<string, unknown>[];

        const now = Date.now();
        return sections
            .filter((s) => {
                const startsAt = s.starts_at as Date | null;
                const endsAt = s.ends_at as Date | null;
                if (startsAt && startsAt.getTime() > now) return false;
                if (endsAt && endsAt.getTime() < now) return false;
                return true;
            })
            .map((s) => ({
                ...s,
                config: parseJsonField<unknown>(s.config),
                visibility: parseJsonField<unknown>(s.visibility),
                theme: parseJsonField<unknown>(s.theme),
            }))
            .sort((a, b) => (((a as any).sort_order as number) ?? 0) - (((b as any).sort_order as number) ?? 0));
    }

    async reorderHomepageSections(orderedIds: string[]) {
        for (let i = 0; i < orderedIds.length; i++) {
            await this.updateCmsHomepageSections({
                selector: { id: orderedIds[i] },
                data: { sort_order: i },
            });
        }
    }

    // ── Banners ──────────────────────────────────────────────────────────

    async createBanner(input: BannerInput) {
        return this.createCmsBanners({
            title: input.title ?? null,
            image_url: input.image_url,
            mobile_image_url: input.mobile_image_url ?? null,
            link_url: input.link_url ?? null,
            alt_text: input.alt_text ?? null,
            sort_order: input.sort_order ?? 0,
            is_active: input.is_active ?? true,
            starts_at: input.starts_at ?? null,
            ends_at: input.ends_at ?? null,
            target: stringifyJson(input.target),
            language_code: input.language_code ?? "en",
        });
    }

    async updateBanner(id: string, input: Partial<BannerInput>) {
        const data: Record<string, unknown> = {};
        if (input.title !== undefined) data.title = input.title;
        if (input.image_url !== undefined) data.image_url = input.image_url;
        if (input.mobile_image_url !== undefined) data.mobile_image_url = input.mobile_image_url;
        if (input.link_url !== undefined) data.link_url = input.link_url;
        if (input.alt_text !== undefined) data.alt_text = input.alt_text;
        if (input.sort_order !== undefined) data.sort_order = input.sort_order;
        if (input.is_active !== undefined) data.is_active = input.is_active;
        if (input.starts_at !== undefined) data.starts_at = input.starts_at;
        if (input.ends_at !== undefined) data.ends_at = input.ends_at;
        if (input.target !== undefined) data.target = stringifyJson(input.target);
        if (input.language_code !== undefined) data.language_code = input.language_code;
        return this.updateCmsBanners({ selector: { id }, data });
    }

    async getActiveBanners(languageCode = "en") {
        const banners = (await this.listCmsBanners({
            is_active: true,
            language_code: languageCode,
        })) as unknown as Record<string, unknown>[];

        const now = Date.now();
        return banners
            .filter((b) => {
                const startsAt = b.starts_at as Date | null;
                const endsAt = b.ends_at as Date | null;
                if (startsAt && startsAt.getTime() > now) return false;
                if (endsAt && endsAt.getTime() < now) return false;
                return true;
            })
            .map((b) => ({ ...b, target: parseJsonField<unknown>(b.target) }))
            .sort((a, b) => (((a as any).sort_order as number) ?? 0) - (((b as any).sort_order as number) ?? 0));
    }

    // ── Navigation ───────────────────────────────────────────────────────

    async createNavigation(input: NavigationInput) {
        return this.createCmsNavigations({
            name: input.name,
            location: input.location,
            items: stringifyJson(input.items),
            is_active: input.is_active ?? true,
            language_code: input.language_code ?? "en",
        });
    }

    async updateNavigation(id: string, input: Partial<NavigationInput>) {
        const data: Record<string, unknown> = {};
        if (input.name !== undefined) data.name = input.name;
        if (input.location !== undefined) data.location = input.location;
        if (input.items !== undefined) data.items = stringifyJson(input.items);
        if (input.is_active !== undefined) data.is_active = input.is_active;
        if (input.language_code !== undefined) data.language_code = input.language_code;
        return this.updateCmsNavigations({ selector: { id }, data });
    }

    async getNavigation(location: string, languageCode = "en") {
        const navs = (await this.listCmsNavigations({
            location,
            is_active: true,
            language_code: languageCode,
        })) as unknown as Record<string, unknown>[];
        if (navs.length === 0) return null;
        return { ...navs[0], items: parseJsonField<unknown[]>(navs[0].items) };
    }

    // ── Redirects ────────────────────────────────────────────────────────

    async createRedirect(input: RedirectInput) {
        return this.createCmsRedirects({
            from_path: normalizePath(input.from_path),
            to_url: input.to_url,
            redirect_type: input.redirect_type ?? 301,
            is_active: input.is_active ?? true,
        });
    }

    async updateRedirect(id: string, input: Partial<RedirectInput>) {
        const data: Record<string, unknown> = {};
        if (input.from_path !== undefined) data.from_path = normalizePath(input.from_path);
        if (input.to_url !== undefined) data.to_url = input.to_url;
        if (input.redirect_type !== undefined) data.redirect_type = input.redirect_type;
        if (input.is_active !== undefined) data.is_active = input.is_active;
        return this.updateCmsRedirects({ selector: { id }, data });
    }

    /**
     * Resolve a redirect for a given path. Returns the target + type or null.
     */
    async resolveRedirect(fromPath: string) {
        const normalized = normalizePath(fromPath);
        const redirects = (await this.listCmsRedirects({
            from_path: normalized,
            is_active: true,
        })) as unknown as Record<string, unknown>[];
        if (redirects.length === 0) return null;
        return {
            to_url: redirects[0].to_url as string,
            redirect_type: redirects[0].redirect_type as number,
        };
    }

    // ── Categories & Tags ─────────────────────────────────────────────────

    async createCategory(name: string, slug?: string, parentId?: string | null) {
        return this.createCmsCategories({
            name,
            slug: slugify(slug ?? name),
            description: null,
            parent_id: parentId ?? null,
        });
    }

    async createTag(name: string) {
        return this.createCmsTags({ name, slug: slugify(name) });
    }

    // ── Blocks ───────────────────────────────────────────────────────────

    async createBlock(name: string, identifier: string, type: string, content: unknown, languageCode = "en") {
        return this.createCmsBlocks({
            name,
            identifier,
            type,
            content: stringifyJson(content),
            language_code: languageCode,
        });
    }

    async getBlock(identifier: string, languageCode = "en") {
        const blocks = (await this.listCmsBlocks({
            identifier,
            language_code: languageCode,
        })) as unknown as Record<string, unknown>[];
        if (blocks.length === 0) return null;
        return { ...blocks[0], content: parseJsonField<unknown>(blocks[0].content) };
    }

    // ── Templates ────────────────────────────────────────────────────────

    async createTemplate(name: string, type: string, structure: unknown, description?: string | null) {
        return this.createCmsTemplates({
            name,
            type,
            structure: stringifyJson(structure),
            description: description ?? null,
        });
    }

    // ── Asset references ──────────────────────────────────────────────────

    async linkAsset(entityType: string, entityId: string, mediaId: string, field?: string | null) {
        return this.createCmsAssetReferences({
            entity_type: entityType,
            entity_id: entityId,
            media_id: mediaId,
            field: field ?? null,
        });
    }

    // ── SEO Dashboard overview ─────────────────────────────────────────────
    /**
     * Aggregate SEO health metrics for the admin SEO Dashboard:
     *   - total pages, published pages, pages missing meta_title / meta_description
     *   - total blog posts, published blog posts
     *   - total redirects, active redirects
     *   - total homepage sections, active homepage sections
     *   - total banners, active banners
     *   - total navigations, active navigations
     *
     * Used by the admin SEO Dashboard tab to surface meta coverage gaps and
     * content inventory at a glance.
     */
    async getSeoOverview() {
        const [
            pages,
            blogPosts,
            redirects,
            sections,
            banners,
            navigations,
        ] = (await Promise.all([
            this.listCmsPages({}) as Promise<Record<string, unknown>[]>,
            this.listCmsPages({ type: "blog" }) as Promise<Record<string, unknown>[]>,
            this.listCmsRedirects({}) as Promise<Record<string, unknown>[]>,
            this.listCmsHomepageSections({}) as Promise<Record<string, unknown>[]>,
            this.listCmsBanners({}) as Promise<Record<string, unknown>[]>,
            this.listCmsNavigations({}) as Promise<Record<string, unknown>[]>,
        ])) as unknown as Record<string, unknown>[][];

        const publishedPages = pages.filter((p) => p.status === "published");
        const missingMetaTitle = publishedPages.filter((p) => !p.meta_title);
        const missingMetaDescription = publishedPages.filter((p) => !p.meta_description);
        const publishedBlog = blogPosts.filter((p) => p.status === "published");
        const activeRedirects = redirects.filter((r) => r.is_active);
        const activeSections = sections.filter((s) => s.is_active);
        const activeBanners = banners.filter((b) => b.is_active);
        const activeNavigations = navigations.filter((n) => n.is_active);

        const metaCoverage =
            publishedPages.length === 0
                ? 100
                : Math.round(
                    ((publishedPages.length -
                        Math.max(missingMetaTitle.length, missingMetaDescription.length)) /
                        publishedPages.length) *
                    100
                );

        return {
            pages: {
                total: pages.length,
                published: publishedPages.length,
                draft: pages.filter((p) => p.status === "draft").length,
                archived: pages.filter((p) => p.status === "archived").length,
                missing_meta_title: missingMetaTitle.length,
                missing_meta_description: missingMetaDescription.length,
                meta_coverage_percent: metaCoverage,
            },
            blog: {
                total: blogPosts.length,
                published: publishedBlog.length,
            },
            redirects: {
                total: redirects.length,
                active: activeRedirects.length,
            },
            homepage_sections: {
                total: sections.length,
                active: activeSections.length,
            },
            banners: {
                total: banners.length,
                active: activeBanners.length,
            },
            navigations: {
                total: navigations.length,
                active: activeNavigations.length,
            },
        };
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(input: string): string {
    return input
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizePath(path: string): string {
    let p = path.trim().toLowerCase();
    if (!p.startsWith("/")) p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
}

export default CmsModuleService;
