export interface ProductListingQuery {
  page?: number;
  limit?: number;
  category_id?: string;
  search?: string;
  is_eggless?: boolean;
}

export interface ProductSearchQuery {
  q: string;
  limit?: number;
  is_eggless?: boolean;
}

export interface ProductFilterQuery {
  page?: number;
  limit?: number;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  is_eggless?: boolean;
  sort_by?: "price_asc" | "price_desc" | "newest";
}

export interface CreateReviewInput {
  rating: number;
  author_name: string;
  comment: string;
  verified_buyer?: boolean;
}

export interface ProductReviewDTOv1 {
  id: string;
  product_id: string;
  rating: number;
  author_name: string;
  comment: string;
  verified_buyer: boolean;
  created_at: string;
}

export type ProductReviewDTO = ProductReviewDTOv1;

export interface ReviewSummaryDTO {
  average_rating: number;
  total_reviews: number;
  rating_breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface AddWishlistItemInput {
  product_id: string;
}

export interface WishlistItemDTOv1 {
  id: string;
  product_id: string;
  product: ProductDTOv1;
  added_at: string;
}

export type WishlistItemDTO = WishlistItemDTOv1;

/**
 * Frozen Version 1 Product DTO Contract
 * Guaranteed non-breaking for storefront SDK integrations.
 */
export interface ProductDTOv1 {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  status: string;
  price: number;
  currency_code: string;
  is_eggless: boolean;
  ingredients: string[];
  allergens: string[];
  shelf_life: string | null;
  storage_instructions: string | null;
  fssai_license_number: string | null;
  video_url: string | null;
  created_at: string;
}

export type ProductDTO = ProductDTOv1;

/**
 * Frozen Version 1 Category DTO Contract
 */
export interface CategoryDTOv1 {
  id: string;
  name: string;
  handle: string;
  description: string | null;
}

export type CategoryDTO = CategoryDTOv1;
