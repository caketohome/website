/**
 * Unit tests for the CMS module service.
 *
 * Tests cover:
 *   - Page creation slugifies the slug
 *   - Page publishing sets status + published_at + creates a revision
 *   - getPublishedPage returns only published, non-future-scheduled pages
 *   - resolveRedirect normalizes the from path and returns the target
 *   - getHomepageSections filters out inactive + out-of-schedule sections and sorts
 *   - Navigation items are JSON-parsed on read
 *
 * These tests mock the MedusaService CRUD methods to unit-test the
 * service logic in isolation.
 */

import CmsModuleService from "../service";

function createMockService(stores: {
    pages?: Record<string, unknown>[];
    sections?: Record<string, unknown>[];
    redirects?: Record<string, unknown>[];
    navigations?: Record<string, unknown>[];
    revisions?: Record<string, unknown>[];
}): { service: CmsModuleService; mocks: Record<string, jest.Mock> } {
    const service = Object.create(CmsModuleService.prototype) as CmsModuleService;

    const pageStore = [...(stores.pages ?? [])];
    const sectionStore = [...(stores.sections ?? [])];
    const redirectStore = [...(stores.redirects ?? [])];
    const navStore = [...(stores.navigations ?? [])];
    const revisionStore = [...(stores.revisions ?? [])];

    const mocks: Record<string, jest.Mock> = {
        createCmsPages: jest.fn(async (data: unknown) => {
            const record = { id: `cmspg_${pageStore.length + 1}`, ...(Array.isArray(data) ? data[0] : data) };
            pageStore.push(record);
            return record;
        }),
        listCmsPages: jest.fn(async (filters: Record<string, unknown>) => {
            return pageStore.filter((p) =>
                Object.entries(filters).every(([k, v]) => p[k] === v)
            );
        }),
        updateCmsPages: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = pageStore.find((p) => p.id === args.selector.id);
            if (record) Object.assign(record, args.data);
        }),
        createCmsRevisions: jest.fn(async (data: unknown) => {
            const record = { id: `cmsrev_${revisionStore.length + 1}`, ...(Array.isArray(data) ? data[0] : data) };
            revisionStore.push(record as Record<string, unknown>);
            return record;
        }),
        listCmsRevisions: jest.fn(async (filters: Record<string, unknown>) => {
            return revisionStore.filter((r) =>
                Object.entries(filters).every(([k, v]) => r[k] === v)
            );
        }),
        listCmsHomepageSections: jest.fn(async (filters: Record<string, unknown>) => {
            return sectionStore.filter((s) =>
                Object.entries(filters).every(([k, v]) => s[k] === v)
            );
        }),
        listCmsRedirects: jest.fn(async (filters: Record<string, unknown>) => {
            return redirectStore.filter((r) =>
                Object.entries(filters).every(([k, v]) => r[k] === v)
            );
        }),
        listCmsNavigations: jest.fn(async (filters: Record<string, unknown>) => {
            return navStore.filter((n) =>
                Object.entries(filters).every(([k, v]) => n[k] === v)
            );
        }),
    };

    (service as unknown as Record<string, unknown>).createCmsPages = mocks.createCmsPages;
    (service as unknown as Record<string, unknown>).listCmsPages = mocks.listCmsPages;
    (service as unknown as Record<string, unknown>).updateCmsPages = mocks.updateCmsPages;
    (service as unknown as Record<string, unknown>).createCmsRevisions = mocks.createCmsRevisions;
    (service as unknown as Record<string, unknown>).listCmsRevisions = mocks.listCmsRevisions;
    (service as unknown as Record<string, unknown>).listCmsHomepageSections = mocks.listCmsHomepageSections;
    (service as unknown as Record<string, unknown>).listCmsRedirects = mocks.listCmsRedirects;
    (service as unknown as Record<string, unknown>).listCmsNavigations = mocks.listCmsNavigations;

    return { service, mocks };
}

describe("CmsModuleService — Pages", () => {
    it("createPage slugifies the slug", async () => {
        const { service, mocks } = createMockService({});
        await service.createPage({ slug: "About Us Page!", title: "About" });
        expect(mocks.createCmsPages).toHaveBeenCalledWith(
            expect.objectContaining({ slug: "about-us-page", title: "About" })
        );
    });

    it("publishPage sets status=published, published_at, and creates a revision", async () => {
        const { service, mocks } = createMockService({
            pages: [{ id: "cmspg_1", slug: "about", title: "About", status: "draft" }],
        });

        const result = await service.publishPage("cmspg_1", "admin");
        expect(result).toEqual(
            expect.objectContaining({ id: "cmspg_1", status: "published" })
        );
        expect(mocks.updateCmsPages).toHaveBeenCalledWith(
            expect.objectContaining({
                selector: { id: "cmspg_1" },
                data: expect.objectContaining({ status: "published" }),
            })
        );
        expect(mocks.createCmsRevisions).toHaveBeenCalled();
    });

    it("getPublishedPage returns null for a future-scheduled page", async () => {
        const { service } = createMockService({
            pages: [
                {
                    id: "cmspg_1",
                    slug: "promo",
                    title: "Promo",
                    status: "published",
                    published_at: new Date(Date.now() + 60 * 60 * 1000), // 1h in future
                    language_code: "en",
                    blocks: null,
                },
            ],
        });

        const page = await service.getPublishedPage("promo", "en");
        expect(page).toBeNull();
    });

    it("getPublishedPage returns the page when published and not future-scheduled", async () => {
        const { service } = createMockService({
            pages: [
                {
                    id: "cmspg_1",
                    slug: "about",
                    title: "About",
                    status: "published",
                    published_at: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
                    language_code: "en",
                    blocks: '[{"type":"paragraph","content":"Hello"}]',
                },
            ],
        });

        const page = await service.getPublishedPage("about", "en");
        expect(page).not.toBeNull();
        expect((page as Record<string, unknown>).title).toBe("About");
        // blocks should be parsed from JSON string to array
        expect(Array.isArray((page as Record<string, unknown>).blocks)).toBe(true);
    });
});

describe("CmsModuleService — Redirects", () => {
    it("resolveRedirect normalizes the from path and returns the target", async () => {
        const { service } = createMockService({
            redirects: [
                { id: "cmsred_1", from_path: "/old-page", to_url: "/new-page", redirect_type: 301, is_active: true },
            ],
        });

        // Trailing slash + uppercase should normalize to "/old-page".
        const redirect = await service.resolveRedirect("/Old-Page/");
        expect(redirect).toEqual({ to_url: "/new-page", redirect_type: 301 });
    });

    it("resolveRedirect returns null when no redirect exists", async () => {
        const { service } = createMockService({});
        const redirect = await service.resolveRedirect("/nonexistent");
        expect(redirect).toBeNull();
    });
});

describe("CmsModuleService — Homepage sections", () => {
    it("getHomepageSections filters inactive + out-of-schedule and sorts by sort_order", async () => {
        const now = Date.now();
        const { service } = createMockService({
            sections: [
                {
                    id: "s1",
                    name: "Hero",
                    section_type: "hero",
                    sort_order: 2,
                    is_active: true,
                    starts_at: null,
                    ends_at: null,
                    config: null,
                    visibility: null,
                    theme: null,
                    language_code: "en",
                },
                {
                    id: "s2",
                    name: "Inactive",
                    section_type: "rich_text",
                    sort_order: 1,
                    is_active: false, // inactive — should be filtered
                    starts_at: null,
                    ends_at: null,
                    config: null,
                    visibility: null,
                    theme: null,
                    language_code: "en",
                },
                {
                    id: "s3",
                    name: "Future",
                    section_type: "rich_text",
                    sort_order: 0,
                    is_active: true,
                    starts_at: new Date(now + 60 * 60 * 1000), // future — filtered
                    ends_at: null,
                    config: null,
                    visibility: null,
                    theme: null,
                    language_code: "en",
                },
                {
                    id: "s4",
                    name: "Categories",
                    section_type: "categories",
                    sort_order: 0,
                    is_active: true,
                    starts_at: null,
                    ends_at: null,
                    config: '{"foo":"bar"}',
                    visibility: null,
                    theme: null,
                    language_code: "en",
                },
            ],
        });

        const sections = (await service.getHomepageSections("en")) as Record<string, unknown>[];
        // s2 (inactive) and s3 (future) should be filtered out.
        expect(sections.length).toBe(2);
        // Sorted by sort_order ascending: s4 (0), s1 (2).
        expect(sections[0].id).toBe("s4");
        expect(sections[1].id).toBe("s1");
        // config should be parsed from JSON.
        expect(sections[0].config).toEqual({ foo: "bar" });
    });
});

describe("CmsModuleService — Navigation", () => {
    it("getNavigation parses items from JSON", async () => {
        const { service } = createMockService({
            navigations: [
                {
                    id: "nav_1",
                    name: "Header",
                    location: "header",
                    is_active: true,
                    items: '[{"label":"Home","url":"/"}]',
                    language_code: "en",
                },
            ],
        });

        const nav = (await service.getNavigation("header", "en")) as Record<string, unknown>;
        expect(nav).not.toBeNull();
        expect(Array.isArray(nav.items)).toBe(true);
        expect((nav.items as Array<Record<string, unknown>>)[0].label).toBe("Home");
    });
});

describe("CmsModuleService — SEO Overview", () => {
    it("getSeoOverview aggregates page, blog, redirect, section, banner, nav counts", async () => {
        const { service } = createMockService({
            pages: [
                { id: "p1", slug: "about", title: "About", status: "published", meta_title: "About", meta_description: "x", type: "page" },
                { id: "p2", slug: "privacy", title: "Privacy", status: "published", meta_title: null, meta_description: null, type: "page" },
                { id: "p3", slug: "draft1", title: "Draft", status: "draft", type: "page" },
                { id: "p4", slug: "post1", title: "Post", status: "published", meta_title: "P", meta_description: "d", type: "blog" },
            ],
            sections: [
                { id: "s1", is_active: true },
                { id: "s2", is_active: false },
            ],
            redirects: [
                { id: "r1", is_active: true },
                { id: "r2", is_active: false },
            ],
            navigations: [
                { id: "n1", is_active: true },
            ],
        });

        (service as unknown as Record<string, unknown>).listCmsBanners = jest.fn(async () => [
            { id: "b1", is_active: true },
            { id: "b2", is_active: false },
            { id: "b3", is_active: true },
        ]);

        const overview = (await service.getSeoOverview()) as Record<string, unknown>;

        expect(overview.pages).toEqual(
            expect.objectContaining({
                total: 4,
                published: 3,
                draft: 1,
                archived: 0,
                missing_meta_title: 1,
                missing_meta_description: 1,
            })
        );
        expect(overview.blog).toEqual({ total: 1, published: 1 });
        expect(overview.redirects).toEqual({ total: 2, active: 1 });
        expect(overview.homepage_sections).toEqual({ total: 2, active: 1 });
        expect(overview.banners).toEqual({ total: 3, active: 2 });
        expect(overview.navigations).toEqual({ total: 1, active: 1 });
    });

    it("getSeoOverview reports 100% meta coverage when no published pages", async () => {
        const { service } = createMockService({ pages: [] });
        (service as unknown as Record<string, unknown>).listCmsBanners = jest.fn(async () => []);

        const overview = (await service.getSeoOverview()) as Record<string, unknown>;
        expect((overview.pages as Record<string, unknown>).meta_coverage_percent).toBe(100);
    });
});
