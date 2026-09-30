import { ProductRepository } from "../repositories/product.repository";
import { ProductDomain, VariantOptionDomain, CreatePackagingProductInput, CreatePackagingProductResult } from "../types/domain";

export class ProductService {
  /**
   * Get all published catalog products
   */
  static async getCatalog(category?: string, search?: string): Promise<ProductDomain[]> {
    let products = await ProductRepository.findAll();

    if (category && category !== "all") {
      const qCat = category.toLowerCase().replace(/-/g, " ");
      products = products.filter(
        (p) =>
          p.category.toLowerCase().includes(qCat) ||
          p.category_slug === category ||
          (p.category_ids && p.category_ids.includes(category))
      );
    }

    if (search) {
      const q = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.flavour && p.flavour.toLowerCase().includes(q))
      );
    }

    return products;
  }

  /**
   * Get product by handle or ID
   */
  static async getProductBySlug(slug: string): Promise<ProductDomain | null> {
    return ProductRepository.findById(slug);
  }

  /**
   * Get all active variant customization options
   */
  static async getVariantOptions(): Promise<{
    flavors: VariantOptionDomain[];
    shapes: VariantOptionDomain[];
    fillings: VariantOptionDomain[];
    creams: VariantOptionDomain[];
  }> {
    const all = await ProductRepository.findAllVariantOptions();
    const active = all.filter((vo) => vo.is_enabled && vo.status === "active");

    return {
      flavors: active.filter((vo) => vo.type === "flavor"),
      shapes: active.filter((vo) => vo.type === "shape"),
      fillings: active.filter((vo) => vo.type === "filling"),
      creams: active.filter((vo) => vo.type === "cream"),
    };
  }

  /**
   * Save product
   */
  static async saveProduct(product: Partial<ProductDomain>): Promise<void> {
    await ProductRepository.save(product);
  }

  /**
   * Create packaging master-data product and its default variant.
   * Enforces validation and calls repository atomic transaction.
   */
  static async createPackagingProduct(
    input: CreatePackagingProductInput,
    actorUserId: string,
    externalClient?: any
  ): Promise<CreatePackagingProductResult> {
    if (!input || typeof input !== "object") {
      throw new Error("Validation error: input object is required.");
    }
    if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
      throw new Error("Validation error: 'title' is required and must be a non-empty string.");
    }
    if (!input.sku || typeof input.sku !== "string" || !input.sku.trim()) {
      throw new Error("Validation error: 'sku' is required and must be a non-empty string.");
    }
    if (input.status && !["draft", "proposed", "published", "rejected"].includes(input.status)) {
      throw new Error("Validation error: 'status' must be one of: draft, proposed, published, rejected.");
    }
    if (input.cost_price !== undefined && input.cost_price !== null) {
      const cost = Number(input.cost_price);
      if (isNaN(cost) || cost < 0) {
        throw new Error("Validation error: 'cost_price' must be a non-negative number if provided.");
      }
    }
    if (input.gst_rate !== undefined && input.gst_rate !== null) {
      const gst = Number(input.gst_rate);
      if (isNaN(gst) || gst < 0 || gst > 100) {
        throw new Error("Validation error: 'gst_rate' must be between 0 and 100 if provided.");
      }
    }
    if (input.hsn_code !== undefined && input.hsn_code !== null) {
      if (typeof input.hsn_code !== "string" || !input.hsn_code.trim()) {
        throw new Error("Validation error: 'hsn_code' must be a valid string if provided.");
      }
    }
    if (input.uqc !== undefined && input.uqc !== null) {
      if (typeof input.uqc !== "string" || !input.uqc.trim()) {
        throw new Error("Validation error: 'uqc' must be a valid string if provided.");
      }
    }

    return ProductRepository.createPackagingProductWithVariant(input, actorUserId, externalClient);
  }
}
