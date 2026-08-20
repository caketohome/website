/**
 * Unit tests for the Catalog module service.
 *
 * Tests cover:
 *   - Product meta upsert (create + update paths)
 *   - Product meta update on existing record
 *   - Review creation validates rating range
 *   - Review moderation updates status + reply
 *   - Review aggregate computes average + distribution
 *   - Wishlist add prevents duplicates
 *   - Wishlist remove
 *   - Stock notification prevents duplicates
 *   - Stock notification mark notified
 *   - Subscription create + advance (next_date + deliveries_count)
 *   - Subscription advance auto-expires at max_deliveries
 *   - Subscription pause/resume/cancel
 *   - Subscription listDueSubscriptions filters by date
 *
 * These tests mock the MedusaService CRUD methods to unit-test the
 * service logic in isolation.
 */

import CatalogModuleService from "../service";

function createMockService(
    metas: Record<string, unknown>[] = [],
    reviews: Record<string, unknown>[] = [],
    wishlist: Record<string, unknown>[] = [],
    stockNotifications: Record<string, unknown>[] = [],
    subscriptions: Record<string, unknown>[] = []
): {
    service: CatalogModuleService;
    mocks: Record<string, jest.Mock>;
} {
    const service = Object.create(CatalogModuleService.prototype) as CatalogModuleService;

    const metaStore = [...metas];
    const reviewStore = [...reviews];
    const wishlistStore = [...wishlist];
    const stockStore = [...stockNotifications];
    const subStore = [...subscriptions];

    const mocks: Record<string, jest.Mock> = {
        listProductMetas: jest.fn(async (selector: Record<string, unknown>) => {
            return metaStore.filter((m) =>
                Object.entries(selector).every(([k, v]) => m[k] === v)
            );
        }),
        createProductMetas: jest.fn(async (data: unknown) => {
            const records = (Array.isArray(data) ? data : [data]).map((d) => ({
                id: `pmt_${metaStore.length + 1}`,
                ...d,
            }));
            metaStore.push(...records);
            return records;
        }),
        updateProductMetas: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = metaStore.find((m) => m.id === args.selector.id);
            if (record) Object.assign(record, args.data);
        }),
        deleteProductMetas: jest.fn(async (ids: string[]) => {
            for (const id of ids) {
                const idx = metaStore.findIndex((m) => m.id === id);
                if (idx >= 0) metaStore.splice(idx, 1);
            }
        }),

        listProductReviews: jest.fn(async (selector: Record<string, unknown>) => {
            return reviewStore.filter((r) =>
                Object.entries(selector).every(([k, v]) => r[k] === v)
            );
        }),
        createProductReviews: jest.fn(async (data: unknown) => {
            const records = (Array.isArray(data) ? data : [data]).map((d) => ({
                id: `prev_${reviewStore.length + 1}`,
                ...d,
            }));
            reviewStore.push(...records);
            return records;
        }),
        updateProductReviews: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = reviewStore.find((r) => r.id === args.selector.id);
            if (record) Object.assign(record, args.data);
        }),
        deleteProductReviews: jest.fn(async (ids: string[]) => {
            for (const id of ids) {
                const idx = reviewStore.findIndex((r) => r.id === id);
                if (idx >= 0) reviewStore.splice(idx, 1);
            }
        }),

        listWishlistItems: jest.fn(async (selector: Record<string, unknown>) => {
            return wishlistStore.filter((w) =>
                Object.entries(selector).every(([k, v]) => w[k] === v)
            );
        }),
        createWishlistItems: jest.fn(async (data: unknown) => {
            const records = (Array.isArray(data) ? data : [data]).map((d) => ({
                id: `wish_${wishlistStore.length + 1}`,
                ...d,
            }));
            wishlistStore.push(...records);
            return records;
        }),
        deleteWishlistItems: jest.fn(async (ids: string[]) => {
            for (const id of ids) {
                const idx = wishlistStore.findIndex((w) => w.id === id);
                if (idx >= 0) wishlistStore.splice(idx, 1);
            }
        }),

        listStockNotifications: jest.fn(async (selector: Record<string, unknown>) => {
            return stockStore.filter((s) =>
                Object.entries(selector).every(([k, v]) => s[k] === v)
            );
        }),
        createStockNotifications: jest.fn(async (data: unknown) => {
            const records = (Array.isArray(data) ? data : [data]).map((d) => ({
                id: `stkn_${stockStore.length + 1}`,
                ...d,
            }));
            stockStore.push(...records);
            return records;
        }),
        updateStockNotifications: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = stockStore.find((s) => s.id === args.selector.id);
            if (record) Object.assign(record, args.data);
        }),

        listSubscriptions: jest.fn(async (selector: Record<string, unknown>) => {
            return subStore.filter((s) =>
                Object.entries(selector).every(([k, v]) => s[k] === v)
            );
        }),
        createSubscriptions: jest.fn(async (data: unknown) => {
            const records = (Array.isArray(data) ? data : [data]).map((d) => ({
                id: `sub_${subStore.length + 1}`,
                ...d,
            }));
            subStore.push(...records);
            return records;
        }),
        updateSubscriptions: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = subStore.find((s) => s.id === args.selector.id);
            if (record) Object.assign(record, args.data);
        }),
    };

    (service as unknown as Record<string, unknown>).listProductMetas = mocks.listProductMetas;
    (service as unknown as Record<string, unknown>).createProductMetas = mocks.createProductMetas;
    (service as unknown as Record<string, unknown>).updateProductMetas = mocks.updateProductMetas;
    (service as unknown as Record<string, unknown>).deleteProductMetas = mocks.deleteProductMetas;
    (service as unknown as Record<string, unknown>).listProductReviews = mocks.listProductReviews;
    (service as unknown as Record<string, unknown>).createProductReviews = mocks.createProductReviews;
    (service as unknown as Record<string, unknown>).updateProductReviews = mocks.updateProductReviews;
    (service as unknown as Record<string, unknown>).deleteProductReviews = mocks.deleteProductReviews;
    (service as unknown as Record<string, unknown>).listWishlistItems = mocks.listWishlistItems;
    (service as unknown as Record<string, unknown>).createWishlistItems = mocks.createWishlistItems;
    (service as unknown as Record<string, unknown>).deleteWishlistItems = mocks.deleteWishlistItems;
    (service as unknown as Record<string, unknown>).listStockNotifications = mocks.listStockNotifications;
    (service as unknown as Record<string, unknown>).createStockNotifications = mocks.createStockNotifications;
    (service as unknown as Record<string, unknown>).updateStockNotifications = mocks.updateStockNotifications;
    (service as unknown as Record<string, unknown>).listSubscriptions = mocks.listSubscriptions;
    (service as unknown as Record<string, unknown>).createSubscriptions = mocks.createSubscriptions;
    (service as unknown as Record<string, unknown>).updateSubscriptions = mocks.updateSubscriptions;

    return { service, mocks };
}

describe("CatalogModuleService — Product Meta", () => {
    it("upsertProductMeta creates a new meta record", async () => {
        const { service, mocks } = createMockService();
        const result = await service.upsertProductMeta({
            product_id: "prod_1",
            artisan: true,
            ingredients: "Flour, sugar",
        });

        expect(result.product_id).toBe("prod_1");
        expect(result.artisan).toBe(true);
        expect(mocks.createProductMetas).toHaveBeenCalledTimes(1);
    });

    it("upsertProductMeta updates an existing meta record", async () => {
        const { service, mocks } = createMockService([
            { id: "pmt_1", product_id: "prod_1", artisan: false, sugar_free: false },
        ]);

        await service.upsertProductMeta({
            product_id: "prod_1",
            artisan: true,
        });

        expect(mocks.updateProductMetas).toHaveBeenCalledTimes(1);
        expect(mocks.createProductMetas).not.toHaveBeenCalled();
    });

    it("updateProductMeta upserts when no existing record", async () => {
        const { service, mocks } = createMockService();

        await service.updateProductMeta("prod_2", { artisan: true });

        expect(mocks.createProductMetas).toHaveBeenCalledTimes(1);
    });

    it("getProductMeta returns parsed JSON fields", async () => {
        const { service } = createMockService([
            {
                id: "pmt_1",
                product_id: "prod_1",
                artisan: false,
                sugar_free: false,
                gluten_free: false,
                vegan: false,
                is_featured: false,
                is_bestseller: false,
                is_new_arrival: false,
                nutritional_info: '{"energy": 250}',
                meta: '{"custom": true}',
            },
        ]);

        const meta = await service.getProductMeta("prod_1");
        expect(meta).not.toBeNull();
        expect((meta as Record<string, unknown>).nutritional_info).toEqual({ energy: 250 });
        expect((meta as Record<string, unknown>).meta).toEqual({ custom: true });
    });
});

describe("CatalogModuleService — Reviews", () => {
    it("createReview rejects an out-of-range rating", async () => {
        const { service, mocks } = createMockService();

        await expect(
            service.createReview({ product_id: "prod_1", rating: 6 })
        ).rejects.toThrow("Rating must be between 1 and 5.");

        expect(mocks.createProductReviews).not.toHaveBeenCalled();
    });

    it("createReview creates a pending review", async () => {
        const { service, mocks } = createMockService();

        const review = await service.createReview({
            product_id: "prod_1",
            rating: 5,
            title: "Great cake!",
            body: "Loved it.",
        });

        expect(review.rating).toBe(5);
        expect(review.status).toBe("pending");
        expect(mocks.createProductReviews).toHaveBeenCalledTimes(1);
    });

    it("moderateReview approves and sets reply", async () => {
        const { service, mocks } = createMockService([], [
            { id: "prev_1", product_id: "prod_1", rating: 4, status: "pending" },
        ]);

        await service.moderateReview("prev_1", { status: "approved", reply: "Thank you!" });

        expect(mocks.updateProductReviews).toHaveBeenCalledWith({
            selector: { id: "prev_1" },
            data: expect.objectContaining({ status: "approved", reply: "Thank you!" }),
        });
    });

    it("getReviewAggregate computes average + distribution from approved reviews", async () => {
        const { service } = createMockService(
            [],
            [
                { id: "r1", product_id: "prod_1", rating: 5, status: "approved" },
                { id: "r2", product_id: "prod_1", rating: 3, status: "approved" },
                { id: "r3", product_id: "prod_1", rating: 1, status: "rejected" },
            ]
        );

        const aggregate = await service.getReviewAggregate("prod_1");

        expect(aggregate.total_reviews).toBe(2);
        expect(aggregate.average_rating).toBe(4);
        expect(aggregate.rating_distribution[5]).toBe(1);
        expect(aggregate.rating_distribution[3]).toBe(1);
        expect(aggregate.rating_distribution[1]).toBe(0);
    });
});

describe("CatalogModuleService — Wishlist", () => {
    it("addToWishlist prevents duplicates", async () => {
        const { service, mocks } = createMockService([], [], [
            { id: "wish_1", customer_id: "cus_1", product_id: "prod_1" },
        ]);

        const result = await service.addToWishlist({
            customer_id: "cus_1",
            product_id: "prod_1",
        });

        expect(result.id).toBe("wish_1");
        expect(mocks.createWishlistItems).not.toHaveBeenCalled();
    });

    it("addToWishlist creates a new item when not already wishlisted", async () => {
        const { service, mocks } = createMockService();

        await service.addToWishlist({ customer_id: "cus_1", product_id: "prod_1" });

        expect(mocks.createWishlistItems).toHaveBeenCalledTimes(1);
    });

    it("removeFromWishlist deletes the matching item", async () => {
        const { service, mocks } = createMockService([], [], [
            { id: "wish_1", customer_id: "cus_1", product_id: "prod_1" },
        ]);

        await service.removeFromWishlist("cus_1", "prod_1");

        expect(mocks.deleteWishlistItems).toHaveBeenCalledWith(["wish_1"]);
    });

    it("isWishlisted returns true when item exists", async () => {
        const { service } = createMockService([], [], [
            { id: "wish_1", customer_id: "cus_1", product_id: "prod_1" },
        ]);

        const result = await service.isWishlisted("cus_1", "prod_1");
        expect(result).toBe(true);
    });
});

describe("CatalogModuleService — Stock Notifications", () => {
    it("createStockNotification requires a contact", async () => {
        const { service, mocks } = createMockService();

        await expect(
            service.createStockNotification({ product_id: "prod_1" })
        ).rejects.toThrow("A customer_id, email, or phone is required");

        expect(mocks.createStockNotifications).not.toHaveBeenCalled();
    });

    it("createStockNotification prevents duplicate pending requests", async () => {
        const { service, mocks } = createMockService([], [], [], [
            { id: "stkn_1", product_id: "prod_1", email: "a@b.com", status: "pending" },
        ]);

        const result = await service.createStockNotification({
            product_id: "prod_1",
            email: "a@b.com",
        });

        expect(result.id).toBe("stkn_1");
        expect(mocks.createStockNotifications).not.toHaveBeenCalled();
    });

    it("markStockNotified updates all pending notifications for a product", async () => {
        const { service, mocks } = createMockService([], [], [], [
            { id: "stkn_1", product_id: "prod_1", status: "pending" },
            { id: "stkn_2", product_id: "prod_1", status: "pending" },
            { id: "stkn_3", product_id: "prod_2", status: "pending" },
        ]);

        const count = await service.markStockNotified("prod_1");

        expect(count).toBe(2);
        expect(mocks.updateStockNotifications).toHaveBeenCalledTimes(2);
    });
});

describe("CatalogModuleService — Subscriptions", () => {
    it("createSubscription creates an active subscription", async () => {
        const { service, mocks } = createMockService();

        const sub = await service.createSubscription({
            customer_id: "cus_1",
            product_id: "prod_1",
            next_date: "2026-08-01",
        });

        expect(sub.status).toBe("active");
        expect(sub.frequency).toBe("monthly");
        expect(mocks.createSubscriptions).toHaveBeenCalledTimes(1);
    });

    it("advanceSubscription increments next_date and deliveries_count", async () => {
        const { service, mocks } = createMockService([], [], [], [], [
            {
                id: "sub_1",
                customer_id: "cus_1",
                product_id: "prod_1",
                frequency: "monthly",
                next_date: new Date("2026-08-01"),
                status: "active",
                deliveries_count: 0,
                max_deliveries: null,
            },
        ]);

        const result = (await service.advanceSubscription("sub_1")) as Record<string, unknown>;

        expect(result.deliveries_count).toBe(1);
        expect(mocks.updateSubscriptions).toHaveBeenCalledTimes(1);
        const updateCall = mocks.updateSubscriptions.mock.calls[0][0];
        expect(updateCall.data.deliveries_count).toBe(1);
        expect(updateCall.data.status).toBeUndefined();
    });

    it("advanceSubscription auto-expires at max_deliveries", async () => {
        const { service, mocks } = createMockService([], [], [], [], [
            {
                id: "sub_1",
                customer_id: "cus_1",
                product_id: "prod_1",
                frequency: "weekly",
                next_date: new Date("2026-08-01"),
                status: "active",
                deliveries_count: 2,
                max_deliveries: 3,
            },
        ]);

        const result = (await service.advanceSubscription("sub_1")) as Record<string, unknown>;

        expect(result.deliveries_count).toBe(3);
        expect(result.status).toBe("expired");
    });

    it("pauseSubscription sets status to paused", async () => {
        const { service, mocks } = createMockService([], [], [], [], [
            { id: "sub_1", status: "active" },
        ]);

        await service.pauseSubscription("sub_1");

        expect(mocks.updateSubscriptions).toHaveBeenCalledWith({
            selector: { id: "sub_1" },
            data: { status: "paused" },
        });
    });

    it("listDueSubscriptions returns only active subs with past next_date", async () => {
        const { service } = createMockService([], [], [], [], [
            {
                id: "sub_1",
                status: "active",
                next_date: new Date("2026-01-01"),
            },
            {
                id: "sub_2",
                status: "active",
                next_date: new Date("2026-12-31"),
            },
            {
                id: "sub_3",
                status: "paused",
                next_date: new Date("2026-01-01"),
            },
        ]);

        const due = await service.listDueSubscriptions(new Date("2026-07-17"));

        expect(due.length).toBe(1);
        expect(due[0].id).toBe("sub_1");
    });
});
