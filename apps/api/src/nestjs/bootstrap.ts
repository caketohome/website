import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

export async function createNestServer() {
  const logger = new Logger("NestBootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  // Enable Cross-Origin Resource Sharing
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    })
  );

  return { app, logger };
}

export async function bootstrapNestStandalone(port: number = 9000) {
  const { app, logger } = await createNestServer();
  await app.listen(port);
  logger.log(`CakeToHome Enterprise NestJS Backend running at http://localhost:${port}/api/v1`);
  return app;
}

