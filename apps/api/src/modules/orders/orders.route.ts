import { Router } from "express";
import { OrdersController } from "./orders.controller";
import { ordersFeatureGuard } from "./orders.middleware";

const router = Router();
const controller = new OrdersController();

// ── Capability 7.1: Order Placement ─────────────────────────────────────────
router.post("/orders", ordersFeatureGuard("orders.placement.v2"), controller.createOrder);
router.get("/orders", ordersFeatureGuard("orders.placement.v2"), controller.listCustomerOrders);
router.get("/orders/:id", ordersFeatureGuard("orders.placement.v2"), controller.getOrder);

// ── Capability 7.2: Kitchen KDS System ───────────────────────────────────────
router.post("/kitchen/ingest-event", ordersFeatureGuard("orders.kds.v2"), controller.ingestOrderEvent);
router.get("/kitchen/tickets", ordersFeatureGuard("orders.kds.v2"), controller.listKitchenTickets);
router.patch("/kitchen/tickets/:ticketId", ordersFeatureGuard("orders.kds.v2"), controller.updateKitchenTicketStatus);

export { router as ordersRouter };
