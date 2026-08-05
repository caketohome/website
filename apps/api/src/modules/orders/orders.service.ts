import { OrderRepository } from "./orders.repository";
import { CreateOrderInput, UpdateTicketStatusInput, IngestOrderEventInput } from "./orders.types";
import { OutboxPublisherService } from "../../core/events/outbox-publisher.service";
import { NotFoundError } from "../../core/errors/app-error";

export class OrdersService {
  private repository: OrderRepository;

  constructor(repository: OrderRepository = new OrderRepository()) {
    this.repository = repository;
  }

  async createOrder(input: CreateOrderInput) {
    if (input.idempotencyKey) {
      const existingOrder = await this.repository.findByIdempotencyKey(input.idempotencyKey);
      if (existingOrder) {
        return {
          order: existingOrder,
          outboxEvent: {
            eventType: "OrderCreated",
            aggregateId: existingOrder.id,
            status: "IDEMPOTENT_REPLAY",
          },
          isIdempotentReplay: true,
        };
      }
    }

    const order = await this.repository.createOrder(input);

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "OrderCreated",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        totalAmount: order.pricing.totalAmount,
        branchId: order.branchId,
        status: order.status,
      },
    });

    return {
      order,
      outboxEvent,
      isIdempotentReplay: false,
    };
  }

  async getOrder(orderId: string) {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order with identifier '${orderId}' not found.`);
    }
    return order;
  }

  async listCustomerOrders(customerId: string) {
    return this.repository.listCustomerOrders(customerId);
  }

  async ingestOrderEvent(input: IngestOrderEventInput) {
    return this.repository.ingestOrderEvent(input);
  }

  async listKitchenTickets(branchId?: string, status?: string) {
    return this.repository.listKitchenTickets(branchId, status);
  }

  async updateKitchenTicketStatus(ticketId: string, input: UpdateTicketStatusInput) {
    return this.repository.updateKitchenTicketStatus(ticketId, input);
  }
}
