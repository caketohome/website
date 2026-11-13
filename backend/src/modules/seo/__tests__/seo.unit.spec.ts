import { SeoModuleService } from "../service";

describe("Enterprise SEO, GEO & AEO Platform Unit Tests", () => {
    let service: SeoModuleService;

    beforeEach(() => {
        service = new SeoModuleService();
    });

    test("1. SEO page CRUD and auto-scoring", async () => {
        const page = await service.createSeoPage({
            entity_type: "product",
            entity_id: "prod_001",
            slug: "chocolate-truffle-cake",
            url: "/products/chocolate-truffle-cake",
            meta_title: "Chocolate Truffle Cake — Order Online | CakeToHome",
            meta_description: "Order premium chocolate truffle cake online. Fresh, handcrafted with Belgian chocolate. Same-day delivery available.",
            canonical_url: "https://cakes2home.com/products/chocolate-truffle-cake",
            keywords: "chocolate truffle cake, birthday cake, cake delivery",
            h1_text: "Chocolate Truffle Cake",
            h1_count: 1,
            word_count: 450,
            has_schema: true,
            schema_types: JSON.stringify(["Product"]),
            og_title: "Chocolate Truffle Cake",
            og_image: "https://cakes2home.com/images/chocolate-truffle.jpg",
            internal_links_count: 3,
            images_count: 2,
            images_missing_alt: 0,
        });

        expect(page.id).toMatch(/^seopg_/);
        expect(page.seo_score).toBeGreaterThan(70);
        expect(page.geo_score).toBeGreaterThan(0);
        expect(page.aeo_score).toBe(0); // No AEO entries yet

        // Update
        const updated = await service.updateSeoPage(page.id, { meta_title: "New Title for SEO" });
        expect(updated.meta_title).toBe("New Title for SEO");
        expect(updated.seo_score).toBeGreaterThan(0);

        // List
        const pages = await service.getSeoPages();
        expect(pages.length).toBe(1);

        // Delete
        const deleted = await service.deleteSeoPage(page.id);
        expect(deleted).toBe(true);
        expect((await service.getSeoPages()).length).toBe(0);
    });

    test("2. SEO scoring returns exact 0 when no data exists", async () => {
        const emptyPage = await service.createSeoPage({
            entity_type: "page",
            entity_id: "empty",
            slug: "empty",
            url: "/empty",
        });

        expect(emptyPage.seo_score).toBe(0);
        expect(emptyPage.geo_score).toBe(0);
        expect(emptyPage.aeo_score).toBe(0);
    });

    test("3. Dashboard summary returns exact 0s when empty", async () => {
        const summary = await service.getSeoDashboardSummary();
        expect(summary.total_pages).toBe(0);
        expect(summary.indexed_pages).toBe(0);
        expect(summary.seo_score).toBe(0);
        expect(summary.geo_score).toBe(0);
        expect(summary.aeo_score).toBe(0);
        expect(summary.broken_links).toBe(0);
        expect(summary.missing_alt).toBe(0);
        expect(summary.duplicate_titles).toBe(0);
        expect(summary.tracked_keywords).toBe(0);
        expect(summary.core_web_vitals.lcp_ms).toBe(0);
    });

    test("4. Keyword tracking with ranking history", async () => {
        const kw = await service.createSeoKeyword({
            keyword: "birthday cake delivery kollam",
            search_volume: 1200,
            difficulty: 35,
            current_position: 8,
            target_url: "/cakes/kollam",
            location: "Kollam",
        });

        expect(kw.keyword).toBe("birthday cake delivery kollam");
        expect(kw.current_position).toBe(8);
        expect(kw.best_position).toBe(8);

        // Update ranking
        const updated = await service.updateSeoKeyword(kw.id, { current_position: 5 });
        expect(updated.current_position).toBe(5);
        expect(updated.previous_position).toBe(8);
        expect(updated.best_position).toBe(5);

        const history = JSON.parse(updated.ranking_history);
        expect(history.length).toBe(2);
    });

    test("5. Redirect creation with loop detection", async () => {
        await service.createSeoRedirect({
            source_url: "/old-page",
            target_url: "/new-page",
            status_code: 301,
        });

        // Attempt loop
        await expect(service.createSeoRedirect({
            source_url: "/new-page",
            target_url: "/old-page",
            status_code: 301,
        })).rejects.toThrow("Redirect loop detected");

        // 410 Gone (no target)
        const gone = await service.createSeoRedirect({
            source_url: "/removed-page",
            status_code: 410,
        });
        expect(gone.status_code).toBe(410);
        expect(gone.target_url).toBeNull();
    });

    test("6. Content audit detects thin pages, duplicates, and missing elements", async () => {
        const pages = [
            { id: "p1", url: "/page1", meta_title: "Page One", meta_description: "Desc", word_count: 100, h1_text: null, h1_count: 0, canonical_url: null, has_schema: false },
            { id: "p2", url: "/page2", meta_title: "Page One", meta_description: null, word_count: 500, h1_text: "H1", h1_count: 1, canonical_url: "/page2", has_schema: true },
            { id: "p3", url: "/page3", meta_title: null, meta_description: null, word_count: 50, h1_text: null, h1_count: 3, canonical_url: null, has_schema: false },
        ];

        const result = await service.runContentAudit(pages);
        expect(result.pages_audited).toBe(3);
        expect(result.issues_found).toBeGreaterThanOrEqual(2); // p1 and p3 have issues

        const audits = await service.getSeoContentAudits();
        const p1Audit = audits.find(a => a.page_url === "/page1");
        expect(p1Audit?.is_thin).toBe(true);
        expect(p1Audit?.is_duplicate).toBe(true); // Same title as p2

        const p3Audit = audits.find(a => a.page_url === "/page3");
        expect(p3Audit?.h1_count).toBe(3);
        expect(p3Audit?.has_meta_title).toBe(false);
    });

    test("7. GEO landing page generation with auto-schema and FAQs", async () => {
        const geoPage = await service.generateGeoLandingPage({
            city: "Kochi",
            area: "Kakkanad",
            page_type: "area",
        });

        expect(geoPage.slug).toBe("cakes/kakkanad");
        expect(geoPage.meta_title).toContain("Kakkanad");
        expect(geoPage.meta_description).toContain("Kakkanad");
        expect(geoPage.h1_text).toContain("Kakkanad");

        // Verify auto-generated FAQs
        const faqs = JSON.parse(geoPage.faqs);
        expect(faqs.length).toBe(3);
        expect(faqs[0].question).toContain("Kakkanad");

        // Verify auto-generated schema
        const schema = JSON.parse(geoPage.schema_json);
        expect(schema["@type"]).toBe("LocalBusiness");
        expect(schema.name).toContain("Kakkanad");

        const geoPages = await service.getSeoGeoPages();
        expect(geoPages.length).toBe(1);
    });

    test("8. AEO entry creation with auto-schema generation", async () => {
        const faq = await service.createAeoEntry({
            entry_type: "faq",
            question: "Do you deliver cakes on the same day in Kollam?",
            answer: "Yes! CakeToHome offers same-day cake delivery across all areas in Kollam including Polayathode, Chinnakada, Kadappakada, and Asramam. Orders placed before 6 PM qualify for same-day delivery.",
            entity_type: "branch",
            entity_id: "branch_kollam",
            page_url: "/cakes/kollam",
        });

        expect(faq.entry_type).toBe("faq");
        expect(faq.quality_score).toBeGreaterThan(50);
        expect(faq.schema_json).toBeTruthy();

        const schema = JSON.parse(faq.schema_json!);
        expect(schema["@type"]).toBe("Question");
        expect(schema.acceptedAnswer["@type"]).toBe("Answer");
    });

    test("9. JSON-LD validation", () => {
        const valid = service.validateJsonLd(JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Chocolate Cake",
        }));
        expect(valid.valid).toBe(true);
        expect(valid.errors.length).toBe(0);

        const invalid = service.validateJsonLd("{ broken json }");
        expect(invalid.valid).toBe(false);
        expect(invalid.errors.length).toBeGreaterThan(0);

        const missingContext = service.validateJsonLd(JSON.stringify({ "@type": "Product" }));
        expect(missingContext.valid).toBe(false);
    });

    test("10. AI content generation produces valid suggestions", () => {
        const titles = service.generateAiSeoContent("meta_title", { name: "Belgian Truffle Cake", city: "Kollam" });
        expect(titles.suggestions.length).toBe(3);
        expect(titles.suggestions[0]).toContain("Belgian Truffle Cake");

        const descriptions = service.generateAiSeoContent("meta_description", { name: "Red Velvet Cake", city: "Kochi" });
        expect(descriptions.suggestions.length).toBe(3);
        expect(descriptions.suggestions[0]).toContain("Red Velvet Cake");

        const faqs = service.generateAiSeoContent("faq", { name: "Mango Cake", city: "Trivandrum" });
        expect(faqs.suggestions.length).toBe(3);
        expect(faqs.suggestions[0].question).toContain("Mango Cake");
    });

    test("11. Page speed recording and CWV tracking", async () => {
        await service.recordPageSpeed({
            page_url: "/",
            device: "mobile",
            lcp_ms: 2100,
            cls: 8, // stored as x1000
            inp_ms: 180,
            fcp_ms: 1200,
            ttfb_ms: 350,
            performance_score: 82,
            js_size_kb: 450,
            css_size_kb: 120,
            image_size_kb: 800,
            total_size_kb: 1370,
        });

        const records = await service.getSeoPageSpeed();
        expect(records.length).toBe(1);
        expect(records[0].lcp_ms).toBe(2100);
        expect(records[0].performance_score).toBe(82);

        // Verify dashboard picks up CWV
        const summary = await service.getSeoDashboardSummary();
        expect(summary.core_web_vitals.lcp_ms).toBe(2100);
        expect(summary.core_web_vitals.performance_score).toBe(82);
    });

    test("12. UTM campaign creation with URL generation", async () => {
        const campaign = await service.createUtmCampaign({
            name: "Instagram Monsoon Sale",
            url: "https://cakes2home.com/products",
            source: "instagram",
            medium: "story",
            campaign: "monsoon_sale_2026",
        });

        expect(campaign.generated_url).toContain("utm_source=instagram");
        expect(campaign.generated_url).toContain("utm_medium=story");
        expect(campaign.generated_url).toContain("utm_campaign=monsoon_sale_2026");
        expect(campaign.click_count).toBe(0);
    });

    test("13. Robots.txt versioning and rollback", async () => {
        const v1 = await service.saveRobotsVersion({
            content: "User-agent: *\nAllow: /",
            notes: "Initial robots.txt",
        });
        expect(v1.version).toBe(1);
        expect(v1.is_active).toBe(true);

        const v2 = await service.saveRobotsVersion({
            content: "User-agent: *\nAllow: /\nDisallow: /admin",
            notes: "Added admin disallow",
        });
        expect(v2.version).toBe(2);
        expect(v2.is_active).toBe(true);

        // Check v1 is deactivated
        const history = await service.getSeoRobotsHistory();
        expect(history[0].is_active).toBe(false);
        expect(history[1].is_active).toBe(true);

        // Rollback to v1
        const rolled = await service.rollbackRobots(v1.id);
        expect(rolled.is_active).toBe(true);
        const afterRollback = await service.getSeoRobotsHistory();
        expect(afterRollback[1].is_active).toBe(false); // v2 deactivated
    });

    test("14. SEO report generation with real summary data", async () => {
        // Create a page first
        await service.createSeoPage({
            entity_type: "product",
            entity_id: "prod_001",
            url: "/products/cake",
            meta_title: "Cake",
            has_schema: true,
        });

        const report = await service.generateSeoReport("overall");
        expect(report.report_type).toBe("overall");
        expect(report.status).toBe("completed");
        expect(report.summary).toContain("SEO Score:");
        expect(report.data).toBeTruthy();

        const parsedData = JSON.parse(report.data);
        expect(parsedData.total_pages).toBe(1);
    });

    test("15. Health report generation reflects actual state", async () => {
        const health = await service.generateHealthReport();
        expect(health.total_pages).toBe(0);
        expect(health.overall_score).toBe(0);
        expect(health.broken_links).toBe(0);

        // Add pages and regenerate
        await service.createSeoPage({
            entity_type: "product",
            entity_id: "p1",
            url: "/p1",
            meta_title: "Product One — CakeToHome Order Online Now",
            meta_description: "Order Product One online from CakeToHome. Fresh, handcrafted with premium ingredients.",
            canonical_url: "/p1",
            h1_text: "Product One",
            h1_count: 1,
            has_schema: true,
            og_title: "Product One",
            word_count: 500,
            internal_links_count: 2,
            keywords: "product one",
            images_count: 1,
            images_missing_alt: 0,
        });

        const health2 = await service.generateHealthReport();
        expect(health2.total_pages).toBe(1);
        expect(health2.overall_score).toBeGreaterThan(0);
    });
});
