import { CatalogRepository } from "./catalog.repository";
import { ProductListingQuery, ProductSearchQuery, ProductFilterQuery, CreateReviewInput, AddWishlistItemInput } from "./catalog.types";
import { NotFoundError } from "../../core/errors/app-error";

export class CatalogService {
  private repository: CatalogRepository;

  constructor(repository: CatalogRepository = new CatalogRepository()) {
    this.repository = repository;
  }

  async listProducts(query: ProductListingQuery) {
    const { products, total } = await this.repository.listProducts(query);
    return {
      products,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
      },
    };
  }

  async searchProducts(query: ProductSearchQuery) {
    const products = await this.repository.searchProducts(query);
    return {
      products,
      meta: {
        query: query.q,
        count: products.length,
      },
    };
  }

  async filterProducts(query: ProductFilterQuery) {
    const { products, total } = await this.repository.filterProducts(query);
    return {
      products,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        applied_filters: {
          min_price: query.min_price || null,
          max_price: query.max_price || null,
          is_artisan: query.is_artisan ?? null,
          sort_by: query.sort_by || null,
        },
      },
    };
  }

  async getProductById(id: string) {
    const product = await this.repository.findProductById(id);
    if (!product) {
      throw new NotFoundError(`Product with identifier '${id}' not found.`);
    }
    return product;
  }

  async listProductReviews(productId: string) {
    await this.getProductById(productId);
    const reviews = await this.repository.listProductReviews(productId);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviews.forEach((r) => {
      sum += r.rating;
      const key = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5;
      breakdown[key] = (breakdown[key] || 0) + 1;
    });

    const total = reviews.length;
    const avg = total > 0 ? Number((sum / total).toFixed(1)) : 0;

    return {
      reviews,
      summary: {
        average_rating: avg,
        total_reviews: total,
        rating_breakdown: breakdown,
      },
    };
  }

  async createProductReview(productId: string, input: CreateReviewInput) {
    await this.getProductById(productId);
    return this.repository.createProductReview(productId, input);
  }

  async getWishlist() {
    const items = await this.repository.getWishlist();
    return {
      items,
      count: items.length,
    };
  }

  async addToWishlist(input: AddWishlistItemInput) {
    await this.getProductById(input.product_id);
    return this.repository.addToWishlist(input);
  }

  async removeFromWishlist(productId: string) {
    const removed = await this.repository.removeFromWishlist(productId);
    if (!removed) {
      throw new NotFoundError(`Product '${productId}' is not present in wishlist.`);
    }
    return { success: true, removed_product_id: productId };
  }

  async listCategories() {
    return this.repository.listCategories();
  }

  async getCategoryById(id: string) {
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new NotFoundError(`Category with identifier '${id}' not found.`);
    }
    return category;
  }
}
