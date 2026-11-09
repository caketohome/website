/**
 * CakeToHome Enterprise API Engine
 * Primary Architecture: NestJS Backend Architecture (Phase 5 Evolution)
 * Serves versioned REST endpoints under /api/v1/*
 */

import "reflect-metadata";
import { createApp } from "./app";
import { StructuredLogger } from "./core/logger/logger.service";

async function bootstrap() {
  const logger = new StructuredLogger("CakeToHomeApiServer");
  const port = process.env.PORT || 9000;
  const useNest = process.env.USE_NEST !== "false";

  if (useNest) {
    try {
      const { bootstrapNestStandalone } = await import("./nestjs/bootstrap");
      logger.log(`Initializing CakeToHome Enterprise NestJS Backend on port ${port}...`, {
        apiVersion: "v1",
        framework: "NestJS 10+",
        architecture: "Modular Enterprise Backend",
      });
      await bootstrapNestStandalone(Number(port));
      return;
    } catch (nestErr: any) {
      logger.warn(
        `NestJS standalone bootstrap encountered fallback: ${nestErr.message}. Falling back to Enterprise API Engine.`,
        { error: nestErr.stack }
      );
    }
  }

  const app = createApp();

  app.listen(port, () => {
    logger.log(`CakeToHome Core Enterprise API Engine listening on http://localhost:${port}/api/v1`, {
      apiVersion: "v1",
      framework: "Express.js",
      architecture: "Layered Modular Monolith",
    });
  });
}

if (require.main === module) {
  bootstrap();
}

export { bootstrap };
