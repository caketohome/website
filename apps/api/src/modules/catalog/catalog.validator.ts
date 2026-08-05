import { CATALOG_CONSTANTS } from "./catalog.constants";
import { ProductSearchQuery, ProductFilterQuery, CreateReviewInput, AddWishlistItemInput } from "./catalog.types";
import { BadRequestError } from "../../core/errors/app-error";

export function validateProductListingQuery(query: any) {
  const page = Math.max(1, parseInt(query.page || CATALOG_CONSTANTS.DEFAULT_PAGE, 10));
  const limit = Math.min(
    CATALOG_CONSTANTS.MAX_LIMIT,
    Math.max(1, parseInt(query.limit || CATALOG_CONSTANTS.DEFAULT_LIMIT, 10))
  );

  return {
    page,
    limit,
    category_id: query.category_id ? String(query.category_id).trim() : undefined,
    search: query.search ? String(query.search).trim() : undefined,
    is_eggless: query.is_eggless === "true" || query.is_eggless === "1",
  };
}

export function validateSearchQuery(query: any): ProductSearchQuery {
  const q = query.q ? String(query.q).trim() : "";
  if (!q || q.length < 2) {
    throw new BadRequestError("Search query parameter 'q' must be at least 2 characters long.");
  }

  const limit = Math.min(
    CATALOG_CONSTANTS.MAX_LIMIT,
    Math.max(1, parseInt(query.limit || CATALOG_CONSTANTS.DEFAULT_LIMIT, 10))
  );

  return {
    q,
    limit,
    is_eggless: query.is_eggless === "true" || query.is_eggless === "1",
  };
}

export function validateFilterQuery(query: any): ProductFilterQuery {
  const page = Math.max(1, parseInt(query.page || CATALOG_CONSTANTS.DEFAULT_PAGE, 10));
  const limit = Math.min(
    CATALOG_CONSTANTS.MAX_LIMIT,
    Math.max(1, parseInt(query.limit || CATALOG_CONSTANTS.DEFAULT_LIMIT, 10))
  );

  const min_price = query.min_price !== undefined ? parseFloat(query.min_price) : undefined;
  const max_price = query.max_price !== undefined ? parseFloat(query.max_price) : undefined;

  if (min_price !== undefined && isNaN(min_price)) {
    throw new BadRequestError("Query parameter 'min_price' must be a valid number.");
  }
  if (max_price !== undefined && isNaN(max_price)) {
    throw new BadRequestError("Query parameter 'max_price' must be a valid number.");
  }
  if (min_price !== undefined && max_price !== undefined && min_price > max_price) {
    throw new BadRequestError("'min_price' cannot be greater than 'max_price'.");
  }

  const validSorts = ["price_asc", "price_desc", "newest"];
  const sort_by = query.sort_by && validSorts.includes(query.sort_by) ? (query.sort_by as any) : undefined;

  return {
    page,
    limit,
    category_id: query.category_id ? String(query.category_id).trim() : undefined,
    min_price,
    max_price,
    is_eggless: query.is_eggless === "true" || query.is_eggless === "1" ? true : query.is_eggless === "false" ? false : undefined,
    sort_by,
  };
}

export function validateCreateReviewInput(body: any): CreateReviewInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const rating = parseInt(body.rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError("Review rating must be an integer between 1 and 5.");
  }

  const author_name = body.author_name ? String(body.author_name).trim() : "";
  if (!author_name || author_name.length < 2) {
    throw new BadRequestError("Review 'author_name' must be at least 2 characters long.");
  }

  const comment = body.comment ? String(body.comment).trim() : "";
  if (!comment || comment.length < 5) {
    throw new BadRequestError("Review 'comment' must be at least 5 characters long.");
  }

  return {
    rating,
    author_name,
    comment,
    verified_buyer: Boolean(body.verified_buyer ?? true),
  };
}

export function validateAddWishlistItemInput(body: any): AddWishlistItemInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const product_id = body.product_id ? String(body.product_id).trim() : "";
  if (!product_id) {
    throw new BadRequestError("Wishlist item 'product_id' is required.");
  }

  return { product_id };
}
