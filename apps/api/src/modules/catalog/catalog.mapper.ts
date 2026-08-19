import { ProductDTO, CategoryDTO, ProductReviewDTO, WishlistItemDTO } from "./catalog.types";

export class CatalogMapper {
  static toProductDTO(raw: any): ProductDTO {
    if (!raw) return null as any;
    const meta = raw.meta || {};
    return {
      id: raw.id,
      title: raw.title || raw.name || "Untitled Cake",
      handle: raw.handle || `cake-${raw.id}`,
      description: raw.description || null,
      thumbnail: raw.thumbnail || raw.images?.[0]?.url || null,
      status: raw.status || "published",
      price: typeof raw.price === "number" ? raw.price : raw.variants?.[0]?.prices?.[0]?.amount || 499,
      currency_code: raw.currency_code || "INR",
      is_artisan: Boolean(meta.is_artisan ?? raw.is_artisan),
      ingredients: Array.isArray(meta.ingredients) ? meta.ingredients : [],
      allergens: Array.isArray(meta.allergens) ? meta.allergens : [],
      shelf_life: meta.shelf_life || "2 days at 4°C",
      storage_instructions: meta.storage_instructions || "Keep refrigerated",
      fssai_license_number: meta.fssai || "10020042000123",
      video_url: meta.video_url || null,
      created_at: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
    };
  }

  static toCategoryDTO(raw: any): CategoryDTO {
    if (!raw) return null as any;
    return {
      id: raw.id,
      name: raw.name || raw.title || "Uncategorized",
      handle: raw.handle || `category-${raw.id}`,
      description: raw.description || null,
    };
  }

  static toReviewDTO(raw: any): ProductReviewDTO {
    if (!raw) return null as any;
    return {
      id: raw.id,
      product_id: raw.product_id,
      rating: Number(raw.rating || 5),
      author_name: raw.author_name || "Anonymous Customer",
      comment: raw.comment || "",
      verified_buyer: Boolean(raw.verified_buyer ?? true),
      created_at: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
    };
  }

  static toWishlistItemDTO(raw: any): WishlistItemDTO {
    if (!raw) return null as any;
    return {
      id: raw.id,
      product_id: raw.product_id,
      product: CatalogMapper.toProductDTO(raw.product),
      added_at: raw.added_at ? new Date(raw.added_at).toISOString() : new Date().toISOString(),
    };
  }
}
