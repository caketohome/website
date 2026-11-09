import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

@Controller("api/v1/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("outbox/pending")
  async getPending() {
    return await this.notificationsService.getPendingEvents();
  }

  @Post("outbox/queue")
  async queue(@Body() body: any) {
    return await this.notificationsService.queueNotification(body);
  }

  @Post("outbox/:id/processed")
  async markProcessed(@Param("id") id: string) {
    return await this.notificationsService.markProcessed(id);
  }
}

