import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  private static outboxQueue: any[] = [];

  async queueNotification(params: {
    eventType: string;
    aggregateId: string;
    recipientPhone: string;
    payload: any;
  }) {
    const event = {
      id: `outbox_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      event_type: params.eventType,
      aggregate_id: params.aggregateId,
      recipient_phone: params.recipientPhone,
      payload: params.payload,
      status: "PENDING",
      created_at: new Date().toISOString(),
      retry_count: 0,
    };

    NotificationsService.outboxQueue.push(event);
    return event;
  }

  async getPendingEvents() {
    return NotificationsService.outboxQueue.filter((e) => e.status === "PENDING");
  }

  async markProcessed(eventId: string) {
    const item = NotificationsService.outboxQueue.find((e) => e.id === eventId);
    if (item) {
      item.status = "SENT";
      item.sent_at = new Date().toISOString();
    }
    return item;
  }
}

