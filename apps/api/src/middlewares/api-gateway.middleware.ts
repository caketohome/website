import { Request, Response, NextFunction } from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { StructuredLogger } from "../core/logger/logger.service";

const logger = new StructuredLogger("ApiCompatibilityGateway");
const LEGACY_MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const EXPRESS_API_URL = process.env.EXPRESS_API_URL || "http://localhost:9001";
const SHADOW_TRAFFIC_ENABLED = process.env.SHADOW_TRAFFIC_ENABLED === "true";

/**
 * Enterprise API Compatibility & Reverse Proxy Gateway
 * Topology: Gateway (:8080) -> Medusa (:9000) vs Express (:9001)
 */
export function createApiGatewayMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // If request is targeted at native Express v1 API or system health check, proceed directly
    if (req.path.startsWith("/api/v1") || req.path === "/health") {
      return next();
    }

    // Rewrite legacy auth endpoints if targeted directly
    if (req.path === "/store/auth/otp/request") {
      req.url = "/api/v1/auth/otp/request";
      return next();
    }

    if (req.path === "/store/auth/otp/verify") {
      req.url = "/api/v1/auth/otp/verify";
      return next();
    }

    // Execute Shadow Traffic request in background if enabled
    if (SHADOW_TRAFFIC_ENABLED && req.method === "GET" && req.path === "/store/products") {
      executeShadowRequest("/api/v1/products", req);
    }

    // Proxy legacy request to Medusa backend (:9000)
    logger.log(`Proxying legacy request: ${req.method} ${req.path} -> ${LEGACY_MEDUSA_URL}${req.url}`);

    try {
      const targetUrl = new URL(req.url, LEGACY_MEDUSA_URL);
      const options: http.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 9000,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: targetUrl.host,
        },
        timeout: 3000,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      const handleFailover = (errorMsg: string) => {
        logger.warn(`Gateway Failover triggered for ${req.method} ${req.path}: ${errorMsg}`);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: {
              code: "BAD_GATEWAY",
              message: "Legacy Medusa backend service is currently unreachable.",
              details: [],
            },
          });
        }
      };

      proxyReq.on("error", (err) => handleFailover(err.message));
      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        handleFailover("Proxy connection timed out (3000ms)");
      });

      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
        const bodyData = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        proxyReq.write(bodyData);
      }

      proxyReq.end();
    } catch (err: any) {
      logger.error(`Gateway Exception for ${req.path}`, err.stack || String(err));
      if (!res.headersSent) {
        return res.status(502).json({
          success: false,
          error: {
            code: "BAD_GATEWAY",
            message: "Legacy backend service failure.",
            details: [],
          },
        });
      }
    }
  };
}

function executeShadowRequest(shadowPath: string, req: Request) {
  try {
    const url = new URL(EXPRESS_API_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 9001,
      path: shadowPath,
      method: "GET",
      timeout: 2000,
    };

    const shadowReq = http.request(options, (shadowRes) => {
      shadowRes.on("data", () => {});
      shadowRes.on("end", () => {
        logger.log(`Shadow Traffic executed for ${shadowPath} (Status: ${shadowRes.statusCode})`);
        recordDataParityResult(shadowPath, shadowRes.statusCode === 200);
      });
    });

    shadowReq.on("error", () => {
      logger.warn(`Shadow Traffic request failed for ${shadowPath}`);
      recordDataParityResult(shadowPath, false);
    });

    shadowReq.end();
  } catch {
    // Non-blocking
  }
}

function recordDataParityResult(capabilityPath: string, isMatch: boolean) {
  try {
    const dir = path.resolve(__dirname, "../../verification/shadow");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const parityData = {
      capability: capabilityPath,
      status_match: isMatch,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, "data-parity.json"), JSON.stringify(parityData, null, 2));
  } catch {
    // Ignore logging errors
  }
}
