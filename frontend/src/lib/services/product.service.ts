import { ProductRepository } from "../repositories/product.repository";
import { ProductDomain, VariantOptionDomain } from "../types/domain";

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
}
