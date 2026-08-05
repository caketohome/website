import { Router } from "express";
import { CartController } from "./cart.controller";
import { cartFeatureGuard } from "./cart.middleware";

const router = Router();
const controller = new CartController();

// ── Capability 6.1: Cart Session ─────────────────────────────────────────────
router.get("/cart", cartFeatureGuard("cart.session.v2"), controller.getCart);
router.post("/cart/items", cartFeatureGuard("cart.session.v2"), controller.addItem);

// ── Capability 6.2: Custom Cake Items ────────────────────────────────────────
router.post("/cart/custom-cake", cartFeatureGuard("cart.custom_cake.v2"), controller.addCustomCake);

router.patch("/cart/items/:itemId", cartFeatureGuard("cart.session.v2"), controller.updateItem);
router.delete("/cart/items/:itemId", cartFeatureGuard("cart.session.v2"), controller.removeItem);
router.post("/cart/merge", cartFeatureGuard("cart.session.v2"), controller.mergeCart);
router.post("/cart/promo", cartFeatureGuard("cart.session.v2"), controller.applyPromo);

export { router as cartRouter };
