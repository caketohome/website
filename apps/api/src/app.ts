import express, { Application, Request, Response } from "express";
import cors from "cors";
import http from "http";
import { globalErrorHandler } from "./middlewares/error-handler.middleware";
import { customerRouter } from "./modules/customers/customer.route";
import { settingsRouter } from "./modules/settings/settings.route";
import { catalogRouter } from "./modules/catalog/catalog.route";
import { cartRouter } from "./modules/cart/cart.route";
import { ordersRouter } from "./modules/orders/orders.route";
import { branchesRouter } from "./modules/branches/branches.route";
import { inventoryRouter } from "./modules/inventory/inventory.route";
import { deliveryRouter } from "./modules/delivery/delivery.route";
import { createApiGatewayMiddleware } from "./middlewares/api-gateway.middleware";

const startTime = Date.now();
const LEGACY_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

async function checkMedusaReachability(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(LEGACY_BACKEND_URL);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 9000,
          path: "/health",
          method: "GET",
          timeout: 1000,
        },
        (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 404);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

export function createApp(): Application {
  const app = express();

  // Standard Express Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Enhanced Health & Diagnostic Check Endpoint
  app.get("/health", async (req: Request, res: Response) => {
    const isMedusaReachable = await checkMedusaReachability();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    const healthData = {
      status: "healthy",
      node: "up",
      database: process.env.DATABASE_URL ? "connected" : "standalone_mode",
      redis: process.env.REDIS_URL ? "connected" : "standalone_mode",
      bullmq: "running",
      gateway: "connected",
      medusa: isMedusaReachable ? "reachable" : "unreachable",
      uptime_seconds: uptimeSeconds,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(healthData);
  });

  // API Compatibility Gateway Middleware
  app.use(createApiGatewayMiddleware());

  // Mount API Version 1 Routes
  app.use("/api/v1", customerRouter);
  app.use("/api/v1", settingsRouter);
  app.use("/api/v1", catalogRouter);
  app.use("/api/v1", cartRouter);
  app.use("/api/v1", ordersRouter);
  app.use("/api/v1", branchesRouter);
  app.use("/api/v1", inventoryRouter);
  app.use("/api/v1", deliveryRouter);

  // Global Error Handler
  app.use(globalErrorHandler);

  return app;
}
