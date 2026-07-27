/**
 * CakeToHome Core API - Payments & Webhooks Domain Service (Phase 1 Feature 6)
 * Manages Payment Lifecycle State Machine, Payment Attempts, Razorpay/UPI Webhook Ledger Deduplication,
 * Refund Engine, and Atomic Outbox Event Publishing.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service";

export interface PaymentAttemptDto {
  id: string;
  orderId: string;
  transactionId: string;
  provider: "RAZORPAY" | "STRIPE" | "UPI" | "COD";
  amount: string;
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  errorMessage?: string;
  createdAt: string;
}

export class PaymentsService {
  private static webhookLedger: Set<string> = new Set();
  private payments: Map<string, PaymentAttemptDto> = new Map();

  async processWebhook(webhookPayload: {
    eventId: string;
    orderId: string;
    transactionId: string;
    provider: "RAZORPAY" | "STRIPE" | "UPI" | "COD";
    amount: string;
    status: "CAPTURED" | "FAILED";
    signature: string;
  }): Promise<{ processed: boolean; outboxEvent: any }> {
    if (PaymentsService.webhookLedger.has(webhookPayload.eventId)) {
      return {
        processed: true,
        outboxEvent: { eventType: "PaymentWebhookIgnored", aggregateId: webhookPayload.eventId, note: "DUPLICATE_WEBHOOK_EVENT" },
      };
    }

    PaymentsService.webhookLedger.add(webhookPayload.eventId);

    const paymentId = `pay_${Date.now()}`;
    const attempt: PaymentAttemptDto = {
      id: paymentId,
      orderId: webhookPayload.orderId,
      transactionId: webhookPayload.transactionId,
      provider: webhookPayload.provider,
      amount: webhookPayload.amount,
      status: webhookPayload.status === "CAPTURED" ? "CAPTURED" : "FAILED",
      createdAt: new Date().toISOString(),
    };

    this.payments.set(paymentId, attempt);

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: webhookPayload.status === "CAPTURED" ? "PaymentCaptured" : "PaymentFailed",
      aggregateId: webhookPayload.orderId,
      payload: {
        paymentId,
        orderId: webhookPayload.orderId,
        transactionId: webhookPayload.transactionId,
        amount: webhookPayload.amount,
        status: attempt.status,
      },
    });

    return { processed: true, outboxEvent };
  }

  async initiateRefund(paymentId: string, amount: string, reason: string): Promise<{ refund: PaymentAttemptDto; outboxEvent: any }> {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error("Payment record not found");

    payment.status = "REFUNDED";

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "PaymentRefunded",
      aggregateId: payment.orderId,
      payload: { paymentId, orderId: payment.orderId, refundAmount: amount, reason },
    });

    return { refund: payment, outboxEvent };
  }
}
