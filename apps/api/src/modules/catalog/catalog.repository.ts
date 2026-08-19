import { CatalogMapper } from "./catalog.mapper";
import {
  ProductListingQuery,
  ProductSearchQuery,
  ProductFilterQuery,
  CreateReviewInput,
  ProductReviewDTO,
  WishlistItemDTO,
  AddWishlistItemInput,
} from "./catalog.types";

export class CatalogRepository {
  private prisma: any;

  private inMemoryProducts: any[] = [
    {
      id: "prod_01",
      title: "Belgian Chocolate Truffle Cake",
      handle: "belgian-chocolate-truffle-cake",
      description: "Rich 55% dark chocolate ganache layered with moist chocolate sponge.",
      price: 699,
      currency_code: "INR",
      status: "published",
      meta: { is_artisan: true, ingredients: ["Dark Chocolate", "Flour", "Cocoa", "Butter"] },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "prod_02",
      title: "Fresh Strawberry Cream Gateau",
      handle: "fresh-strawberry-cream-gateau",
      description: "Seasonal Mahabaleshwar strawberries layered with vanilla whipped cream.",
      price: 599,
      currency_code: "INR",
      status: "published",
      meta: { is_artisan: false, ingredients: ["Strawberries", "Cream", "Flour", "Eggs"] },
      created_at: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "prod_03",
      title: "Red Velvet Cream Cheese Layer Cake",
      handle: "red-velvet-cream-cheese-cake",
      description: "Classic red velvet with tangy cream cheese frosting.",
      price: 749,
      currency_code: "INR",
      status: "published",
      meta: { is_artisan: true, ingredients: ["Cocoa", "Cream Cheese", "Flour", "Butter"] },
      created_at: "2026-01-10T00:00:00.000Z",
    },
  ];

  private inMemoryCategories: any[] = [
    { id: "cat_01", name: "Custom Cakes", handle: "custom-cakes", description: "Bespoke handcrafted custom cakes for special celebrations." },
    { id: "cat_02", name: "Cupcakes & Mini Cakes", handle: "cupcakes", description: "Freshly baked gourmet cupcakes in assorted flavors." },
    { id: "cat_03", name: "artisan Delights", handle: "artisan", description: "100% vegetarian pure gourmet cakes and pastries." },
  ];

  private inMemoryReviews: ProductReviewDTO[] = [
    {
      id: "rev_01",
      product_id: "prod_01",
      rating: 5,
      author_name: "Ananya Sharma",
      comment: "Absolutely delicious! Rich chocolate flavor and perfectly moist.",
      verified_buyer: true,
      created_at: "2026-01-15T10:00:00.000Z",
    },
    {
      id: "rev_02",
      product_id: "prod_01",
      rating: 4,
      author_name: "Vikram Patel",
      comment: "Great quality cake, delivered right on time.",
      verified_buyer: true,
      created_at: "2026-01-18T14:30:00.000Z",
    },
  ];

  private inMemoryWishlist: WishlistItemDTO[] = [
    {
      id: "wish_01",
      product_id: "prod_01",
      product: CatalogMapper.toProductDTO({
        id: "prod_01",
        title: "Belgian Chocolate Truffle Cake",
        handle: "belgian-chocolate-truffle-cake",
        description: "Rich 55% dark chocolate ganache layered with moist chocolate sponge.",
        price: 699,
        currency_code: "INR",
        status: "published",
        meta: { is_artisan: true, ingredients: ["Dark Chocolate", "Flour", "Cocoa", "Butter"] },
      }),
      added_at: "2026-01-20T08:00:00.000Z",
    },
  ];

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  async listProducts(query: ProductListingQuery) {
    if (this.prisma) {
      const skip = ((query.page || 1) - 1) * (query.limit || 20);
      const take = query.limit || 20;
      const rawList = await this.prisma.product.findMany({
        skip,
        take,
        where: { status: "published" },
        include: { meta: true },
      });
      const total = await this.prisma.product.count({ where: { status: "published" } });
      return {
        products: rawList.map(CatalogMapper.toProductDTO),
        total,
      };
    }

    let filtered = [...this.inMemoryProducts];
    if (query.is_artisan) {
      filtered = filtered.filter((p) => p.meta?.is_artisan);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
    }

    const total = filtered.length;
    const start = ((query.page || 1) - 1) * (query.limit || 20);
    const paginated = filtered.slice(start, start + (query.limit || 20));

    return {
      products: paginated.map(CatalogMapper.toProductDTO),
      total,
    };
  }

  async searchProducts(query: ProductSearchQuery) {
    const searchTerm = query.q.toLowerCase();

    if (this.prisma) {
      const rawList = await this.prisma.product.findMany({
        take: query.limit || 20,
        where: {
          status: "published",
          OR: [
            { title: { contains: searchTerm, mode: "insensitive" } },
            { description: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        include: { meta: true },
      });
      return rawList.map(CatalogMapper.toProductDTO);
    }

    let filtered = this.inMemoryProducts.filter((p) => {
      const matchesTitle = p.title.toLowerCase().includes(searchTerm);
      const matchesDesc = p.description.toLowerCase().includes(searchTerm);
      const matchesIngredient = (p.meta?.ingredients || []).some((i: string) => i.toLowerCase().includes(searchTerm));
      return matchesTitle || matchesDesc || matchesIngredient;
    });

    if (query.is_artisan) {
      filtered = filtered.filter((p) => p.meta?.is_artisan);
    }

    const limited = filtered.slice(0, query.limit || 20);
    return limited.map(CatalogMapper.toProductDTO);
  }

  async filterProducts(query: ProductFilterQuery) {
    if (this.prisma) {
      const where: any = { status: "published" };
      if (query.min_price !== undefined || query.max_price !== undefined) {
        where.price = {};
        if (query.min_price !== undefined) where.price.gte = query.min_price;
        if (query.max_price !== undefined) where.price.lte = query.max_price;
      }
      let orderBy: any = undefined;
      if (query.sort_by === "price_asc") orderBy = { price: "asc" };
      if (query.sort_by === "price_desc") orderBy = { price: "desc" };
      if (query.sort_by === "newest") orderBy = { created_at: "desc" };

      const skip = ((query.page || 1) - 1) * (query.limit || 20);
      const take = query.limit || 20;

      const rawList = await this.prisma.product.findMany({
        skip,
        take,
        where,
        orderBy,
        include: { meta: true },
      });
      const total = await this.prisma.product.count({ where });
      return {
        products: rawList.map(CatalogMapper.toProductDTO),
        total,
      };
    }

    let filtered = [...this.inMemoryProducts];
    if (query.is_artisan !== undefined) {
      filtered = filtered.filter((p) => Boolean(p.meta?.is_artisan) === query.is_artisan);
    }
    if (query.min_price !== undefined) {
      filtered = filtered.filter((p) => p.price >= query.min_price!);
    }
    if (query.max_price !== undefined) {
      filtered = filtered.filter((p) => p.price <= query.max_price!);
    }

    if (query.sort_by === "price_asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (query.sort_by === "price_desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (query.sort_by === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const total = filtered.length;
    const start = ((query.page || 1) - 1) * (query.limit || 20);
    const paginated = filtered.slice(start, start + (query.limit || 20));

    return {
      products: paginated.map(CatalogMapper.toProductDTO),
      total,
    };
  }

  async findProductById(id: string) {
    if (this.prisma) {
      const raw = await this.prisma.product.findUnique({
        where: { id },
        include: { meta: true, reviews: true },
      });
      return CatalogMapper.toProductDTO(raw);
    }
    const found = this.inMemoryProducts.find((p) => p.id === id || p.handle === id);
    return CatalogMapper.toProductDTO(found);
  }

  async listProductReviews(productId: string) {
    if (this.prisma) {
      const rawReviews = await this.prisma.review.findMany({
        where: { product_id: productId },
        orderBy: { created_at: "desc" },
      });
      return rawReviews.map(CatalogMapper.toReviewDTO);
    }
    return this.inMemoryReviews.filter((r) => r.product_id === productId);
  }

  async createProductReview(productId: string, input: CreateReviewInput): Promise<ProductReviewDTO> {
    if (this.prisma) {
      const raw = await this.prisma.review.create({
        data: {
          product_id: productId,
          rating: input.rating,
          author_name: input.author_name,
          comment: input.comment,
          verified_buyer: input.verified_buyer ?? true,
        },
      });
      return CatalogMapper.toReviewDTO(raw);
    }

    const newReview: ProductReviewDTO = {
      id: `rev_${Date.now()}`,
      product_id: productId,
      rating: input.rating,
      author_name: input.author_name,
      comment: input.comment,
      verified_buyer: input.verified_buyer ?? true,
      created_at: new Date().toISOString(),
    };
    this.inMemoryReviews.unshift(newReview);
    return newReview;
  }

  async getWishlist(): Promise<WishlistItemDTO[]> {
    if (this.prisma) {
      const raw = await this.prisma.wishlist.findMany({ include: { product: { include: { meta: true } } } });
      return raw.map(CatalogMapper.toWishlistItemDTO);
    }
    return [...this.inMemoryWishlist];
  }

  async addToWishlist(input: AddWishlistItemInput): Promise<WishlistItemDTO> {
    const product = await this.findProductById(input.product_id);
    if (this.prisma) {
      const raw = await this.prisma.wishlist.create({
        data: { product_id: input.product_id },
        include: { product: { include: { meta: true } } },
      });
      return CatalogMapper.toWishlistItemDTO(raw);
    }

    const existing = this.inMemoryWishlist.find((w) => w.product_id === input.product_id);
    if (existing) return existing;

    const newItem: WishlistItemDTO = {
      id: `wish_${Date.now()}`,
      product_id: input.product_id,
      product,
      added_at: new Date().toISOString(),
    };
    this.inMemoryWishlist.unshift(newItem);
    return newItem;
  }

  async removeFromWishlist(productId: string): Promise<boolean> {
    if (this.prisma) {
      await this.prisma.wishlist.deleteMany({ where: { product_id: productId } });
      return true;
    }
    const idx = this.inMemoryWishlist.findIndex((w) => w.product_id === productId || w.id === productId);
    if (idx !== -1) {
      this.inMemoryWishlist.splice(idx, 1);
      return true;
    }
    return false;
  }

  async listCategories() {
    if (this.prisma) {
      const rawList = await this.prisma.category.findMany({
        where: { is_active: true },
      });
      return rawList.map(CatalogMapper.toCategoryDTO);
    }
    return this.inMemoryCategories.map(CatalogMapper.toCategoryDTO);
  }

  async findCategoryById(id: string) {
    if (this.prisma) {
      const raw = await this.prisma.category.findUnique({ where: { id } });
      return CatalogMapper.toCategoryDTO(raw);
    }
    const found = this.inMemoryCategories.find((c) => c.id === id || c.handle === id);
    return CatalogMapper.toCategoryDTO(found);
  }
}
