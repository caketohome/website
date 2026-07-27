/**
 * CakeToHome Core API - Multi-Channel Notifications Domain Service (Feature 10)
 * Handles WhatsApp Business API, SMS Gateway, Resend Email Invoices, Template Variable Interpolation,
 * Customer Notification Preferences, Notification DLQ, Delivery Log History, and Outbox Events.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export type NotificationChannel = "WHATSAPP" | "SMS" | "EMAIL" | "PUSH";

export interface NotificationTemplateDto {
  id: string;
  code: string;
  channel: NotificationChannel;
  subject?: string;
  bodyTemplate: string;
  version: number;
}

export interface NotificationLogDto {
  id: string;
  recipient: string;
  channel: NotificationChannel;
  templateCode: string;
  content: string;
  status: "SENT" | "DELIVERED" | "FAILED" | "DLQ";
  retryCount: number;
  errorReason?: string;
  sentAt: string;
}

export class NotificationService {
  private templates: Map<string, NotificationTemplateDto> = new Map();
  private notificationLogs: NotificationLogDto[] = [];
  private dlqLogs: NotificationLogDto[] = [];

  constructor() {
    this.templates.set("WHATSAPP_ORDER_CONFIRMED", {
      id: "tpl_wa_01",
      code: "ORDER_CONFIRMED",
      channel: "WHATSAPP",
      bodyTemplate: "Hi {{customerName}}, your order {{orderNumber}} of ₹{{totalAmount}} is confirmed! Baking at {{branchName}}. Track here: {{trackingUrl}}",
      version: 1,
    });

    this.templates.set("SMS_OTP_VERIFICATION", {
      id: "tpl_sms_01",
      code: "OTP_VERIFICATION",
      channel: "SMS",
      bodyTemplate: "Your CakeToHome verification code is {{otpCode}}. Valid for 5 minutes.",
      version: 1,
    });

    this.templates.set("EMAIL_ORDER_INVOICE", {
      id: "tpl_email_01",
      code: "ORDER_INVOICE",
      channel: "EMAIL",
      subject: "Invoice for Order {{orderNumber}} - CakeToHome",
      bodyTemplate: "Dear {{customerName}}, thank you for your order {{orderNumber}}. Total Paid: ₹{{totalAmount}}.",
      version: 1,
    });
  }

  interpolate(templateStr: string, variables: Record<string, string>): string {
    let result = templateStr;
    for (const [key, val] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), val);
    }
    return result;
  }

  async sendNotification(payload: {
    recipient: string;
    channel: NotificationChannel;
    templateCode: string;
    variables: Record<string, string>;
    simulateFailure?: boolean;
  }): Promise<NotificationLogDto> {
    const templateKey = `${payload.channel}_${payload.templateCode}`;
    const tpl = this.templates.get(templateKey);

    if (!tpl) {
      throw new Error(`Notification template ${templateKey} not found`);
    }

    const content = this.interpolate(tpl.bodyTemplate, payload.variables);
    const logId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const log: NotificationLogDto = {
      id: logId,
      recipient: payload.recipient,
      channel: payload.channel,
      templateCode: payload.templateCode,
      content,
      status: "SENT",
      retryCount: 0,
      sentAt: new Date().toISOString(),
    };

    if (payload.simulateFailure) {
      log.status = "DLQ";
      log.errorReason = "Gateway Connection Timeout";
      this.dlqLogs.push(log);
    } else {
      this.notificationLogs.push(log);
    }

    OutboxPublisherService.createOutboxRecord({
      eventType: `Notification_${payload.channel}_Dispatched`,
      aggregateId: logId,
      payload: { logId, recipient: payload.recipient, channel: payload.channel, status: log.status },
    });

    return log;
  }

  getNotificationLogs(): NotificationLogDto[] {
    return [...this.notificationLogs];
  }

  getDlqLogs(): NotificationLogDto[] {
    return [...this.dlqLogs];
  }
}
