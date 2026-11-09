import { Controller, Get } from "@nestjs/common";
import { Public } from "../../guards/public.decorator";

const START_TIME = Date.now();

@Controller()
export class HealthController {
  @Public()
  @Get("health")
  getHealth() {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    return {
      status: "healthy",
      service: "CakeToHome Enterprise NestJS Backend",
      version: "1.0.0",
      node: "up",
      database: process.env.DATABASE_URL ? "connected" : "ready",
      gateway: "connected",
      payment_gateway: "cashfree",
      uptime_seconds: uptimeSeconds,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("api/v1/health")
  getV1Health() {
    return this.getHealth();
  }
}

