import { Router } from "express";
import { CustomerController } from "./customer.controller";
import { customerAuthGuard } from "./customer.middleware";

const router = Router();
const controller = new CustomerController();

// ── Auth Endpoints ──────────────────────────────────────────────────────────
router.post("/auth/otp/request", controller.requestOtp);
router.post("/auth/otp/verify", controller.verifyOtp);

// ── Authenticated Customer Endpoints ────────────────────────────────────────
router.get("/customers/me", customerAuthGuard as any, controller.getProfile);
router.get("/customers/addresses", customerAuthGuard as any, controller.listAddresses);
router.post("/customers/addresses", customerAuthGuard as any, controller.createAddress);
router.delete("/customers/addresses/:id", customerAuthGuard as any, controller.deleteAddress);

export { router as customerRouter };
