import { Router } from "express";
import { DeliveryController } from "./delivery.controller";
import { deliveryFeatureGuard } from "./delivery.middleware";

const router = Router();
const controller = new DeliveryController();

// ── Capability 5.1: Delivery Serviceability & Zones ───────────────────────────
router.get("/delivery/serviceability", deliveryFeatureGuard("delivery.zones.v2"), controller.checkServiceability);
router.get("/delivery/zones", deliveryFeatureGuard("delivery.zones.v2"), controller.listDeliveryZones);
router.get("/delivery/zones/:id", deliveryFeatureGuard("delivery.zones.v2"), controller.getDeliveryZoneById);

// ── Capability 5.2: Slot Capacity Grid ────────────────────────────────────────
router.get("/delivery/slots/grid", deliveryFeatureGuard("delivery.slots.v2"), controller.getSlotCapacityGrid);
router.post("/delivery/slots/reserve", deliveryFeatureGuard("delivery.slots.v2"), controller.reserveSlot);

// ── Capability 8.1: Fleet Delivery & Driver Payouts ──────────────────────────
router.get("/delivery/fleet/drivers", deliveryFeatureGuard("fleet.delivery.v2"), controller.listDrivers);
router.post("/delivery/fleet/jobs", deliveryFeatureGuard("fleet.delivery.v2"), controller.createDeliveryJob);
router.post("/delivery/fleet/jobs/:id/complete", deliveryFeatureGuard("fleet.delivery.v2"), controller.completeDelivery);

export { router as deliveryRouter };
