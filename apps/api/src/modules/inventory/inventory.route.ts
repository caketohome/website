import { Router } from "express";
import { InventoryController } from "./inventory.controller";
import { inventoryFeatureGuard } from "./inventory.middleware";

const router = Router();
const controller = new InventoryController();

// ── Capability 4.2: 3-State Stock Matrix ─────────────────────────────────────
router.get("/inventory/matrix", inventoryFeatureGuard("branches.inventory.v2"), controller.getStockMatrix);
router.post("/inventory/reserve", inventoryFeatureGuard("branches.inventory.v2"), controller.reserveStock);
router.post("/inventory/release", inventoryFeatureGuard("branches.inventory.v2"), controller.releaseReservation);
router.post("/inventory/confirm-sale", inventoryFeatureGuard("branches.inventory.v2"), controller.confirmSale);

export { router as inventoryRouter };
