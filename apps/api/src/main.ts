/**
 * CakeToHome Core API Engine (Enterprise Express Engine)
 * Serves versioned REST endpoints under /api/v1/*
 */

import { createApp } from "./app";
import { StructuredLogger } from "./core/logger/logger.service";

async function bootstrap() {
  const logger = new StructuredLogger("CakeToHomeApiServer");
  const port = process.env.PORT || 9000;
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
