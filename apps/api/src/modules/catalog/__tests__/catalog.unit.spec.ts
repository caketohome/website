import { CatalogService } from "../catalog.service";
import { validateSearchQuery, validateFilterQuery, validateCreateReviewInput, validateAddWishlistItemInput } from "../catalog.validator";

describe("CatalogService Capability 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 Unit Tests", () => {
  let service: CatalogService;

  beforeEach(() => {
    service = new CatalogService();
  });

  it("Capability 3.1: should list products with pagination and DTO mapping", async () => {
    const result = await service.listProducts({ page: 1, limit: 10 });
    expect(result.products).toBeDefined();
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].id).toBeDefined();
    expect(result.products[0].title).toBeDefined();
    expect(result.products[0].price).toBeGreaterThan(0);
    expect(result.meta.page).toBe(1);
    expect(result.meta.total).toBeGreaterThan(0);
  });

  it("Capability 3.1: should filter products by eggless flag", async () => {
    const result = await service.listProducts({ is_eggless: true });
    expect(result.products.every((p) => p.is_eggless)).toBe(true);
  });

  it("Capability 3.2: should validate search query parameter length", () => {
    expect(() => validateSearchQuery({ q: "a" })).toThrow("Search query parameter 'q' must be at least 2 characters long.");
    const valid = validateSearchQuery({ q: "chocolate", limit: "5" });
    expect(valid.q).toBe("chocolate");
    expect(valid.limit).toBe(5);
  });

  it("Capability 3.2: should perform product search by query term", async () => {
    const result = await service.searchProducts({ q: "Chocolate" });
    expect(result.products).toBeDefined();
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.some((p) => p.title.toLowerCase().includes("chocolate"))).toBe(true);
    expect(result.meta.query).toBe("Chocolate");
  });

  it("Capability 3.4: should validate min_price and max_price filter range", () => {
    expect(() => validateFilterQuery({ min_price: "1000", max_price: "500" })).toThrow("'min_price' cannot be greater than 'max_price'.");
    const valid = validateFilterQuery({ min_price: "500", max_price: "700", sort_by: "price_asc" });
    expect(valid.min_price).toBe(500);
    expect(valid.max_price).toBe(700);
    expect(valid.sort_by).toBe("price_asc");
  });

  it("Capability 3.4: should filter products by price range and sort ascending", async () => {
    const result = await service.filterProducts({ min_price: 550, max_price: 700, sort_by: "price_asc" });
    expect(result.products).toBeDefined();
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.every((p) => p.price >= 550 && p.price <= 700)).toBe(true);
    expect(result.products[0].price).toBeLessThanOrEqual(result.products[result.products.length - 1].price);
  });

  it("Capability 3.6: should validate review creation rating and comment length", () => {
    expect(() => validateCreateReviewInput({ rating: 6, author_name: "Test", comment: "Great" })).toThrow(
      "Review rating must be an integer between 1 and 5."
    );
    expect(() => validateCreateReviewInput({ rating: 5, author_name: "T", comment: "Great" })).toThrow(
      "Review 'author_name' must be at least 2 characters long."
    );
    const valid = validateCreateReviewInput({ rating: 5, author_name: "Aarav", comment: "Amazing chocolate cake!" });
    expect(valid.rating).toBe(5);
    expect(valid.author_name).toBe("Aarav");
  });

  it("Capability 3.6: should create and list product customer reviews with summary breakdown", async () => {
    const created = await service.createProductReview("prod_01", {
      rating: 5,
      author_name: "Pooja Hegde",
      comment: "Best cake in town!",
    });
    expect(created.id).toBeDefined();
    expect(created.rating).toBe(5);

    const result = await service.listProductReviews("prod_01");
    expect(result.reviews).toBeDefined();
    expect(result.reviews.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.average_rating).toBeGreaterThan(0);
    expect(result.summary.total_reviews).toBe(result.reviews.length);
  });

  it("Capability 3.7: should validate wishlist item input", () => {
    expect(() => validateAddWishlistItemInput({})).toThrow("Wishlist item 'product_id' is required.");
    const valid = validateAddWishlistItemInput({ product_id: "prod_02" });
    expect(valid.product_id).toBe("prod_02");
  });

  it("Capability 3.7: should add product to wishlist and list wishlist items", async () => {
    const added = await service.addToWishlist({ product_id: "prod_02" });
    expect(added.product_id).toBe("prod_02");
    expect(added.product.title).toBeDefined();

    const wishlist = await service.getWishlist();
    expect(wishlist.count).toBeGreaterThan(0);
    expect(wishlist.items.some((i) => i.product_id === "prod_02")).toBe(true);

    const removed = await service.removeFromWishlist("prod_02");
    expect(removed.success).toBe(true);
  });

  it("Capability 3.5: should fetch product PDP details by ID", async () => {
    const product = await service.getProductById("prod_01");
    expect(product.id).toBe("prod_01");
    expect(product.handle).toBe("belgian-chocolate-truffle-cake");
    expect(product.ingredients.length).toBeGreaterThan(0);
  });

  it("Capability 3.3: should list product categories with DTO mapping", async () => {
    const categories = await service.listCategories();
    expect(categories).toBeDefined();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].id).toBeDefined();
    expect(categories[0].name).toBeDefined();
  });

  it("Capability 3.3: should fetch category details by ID", async () => {
    const category = await service.getCategoryById("cat_01");
    expect(category.id).toBe("cat_01");
    expect(category.handle).toBe("custom-cakes");
  });
});
