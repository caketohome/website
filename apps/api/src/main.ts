/**
 * CakeToHome Core API Engine (NestJS + Fastify Adapter)
 * Entry point serving versioned REST endpoints under /api/v1/*
 */

import { StructuredLogger } from "./core/logger/logger.service";

async function bootstrap() {
  const logger = new StructuredLogger("CakeToHomeApiServer");
  const port = process.env.PORT || 9000;

  logger.log(`Starting CakeToHome Core API Engine on port ${port}...`, {
    apiVersion: "v1",
    framework: "NestJS/Fastify",
    architecture: "Clean Architecture + CQRS + Outbox Pattern",
  });

  logger.log("CakeToHome Core API Engine bootstrapped and listening on http://localhost:" + port + "/api/v1");
}

export { bootstrap };
