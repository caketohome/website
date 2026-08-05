import { Router } from "express";
import { CatalogController } from "./catalog.controller";
import { catalogFeatureGuard } from "./catalog.middleware";

const router = Router();
const controller = new CatalogController();

// ── Capability 3.1: Product Listing ─────────────────────────────────────────
router.get("/products", catalogFeatureGuard("catalog.listing.v2"), controller.listProducts);

// ── Capability 3.2: Product Search ──────────────────────────────────────────
router.get("/products/search", catalogFeatureGuard("catalog.search.v2"), controller.searchProducts);

// ── Capability 3.4: Product Filters ─────────────────────────────────────────
router.get("/products/filter", catalogFeatureGuard("catalog.filters.v2"), controller.filterProducts);

// ── Capability 3.7: Wishlist ────────────────────────────────────────────────
router.get("/customers/wishlist", catalogFeatureGuard("catalog.wishlist.v2"), controller.getWishlist);
router.post("/customers/wishlist", catalogFeatureGuard("catalog.wishlist.v2"), controller.addToWishlist);
router.delete("/customers/wishlist/:productId", catalogFeatureGuard("catalog.wishlist.v2"), controller.removeFromWishlist);

// ── Capability 3.6: Product Reviews ─────────────────────────────────────────
router.get("/products/:id/reviews", catalogFeatureGuard("catalog.reviews.v2"), controller.listProductReviews);
router.post("/products/:id/reviews", catalogFeatureGuard("catalog.reviews.v2"), controller.createProductReview);

// ── Capability 3.5: Product Details (PDP) ───────────────────────────────────
router.get("/products/:id", catalogFeatureGuard("catalog.pdp.v2"), controller.getProductById);

// ── Capability 3.3: Product Categories ──────────────────────────────────────
router.get("/categories", catalogFeatureGuard("catalog.categories.v2"), controller.listCategories);
router.get("/categories/:id", catalogFeatureGuard("catalog.categories.v2"), controller.getCategoryById);

export { router as catalogRouter };
