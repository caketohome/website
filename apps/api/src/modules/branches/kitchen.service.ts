/**
 * CakeToHome Core API - Kitchen Display System (KDS) Domain Service (Feature 8)
 * Manages Multi-Station Bakery Workflow, Baking Timers, Priority Engine, Staff Assignment,
 * Mandatory Quality Control (QA), Kitchen Analytics, and Transactional Outbox Events.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export type KitchenStation =
  | "ORDER_RECEIVED"
  | "PREPARATION"
  | "SPONGE_BASE"
  | "CREAM_DECORATION"
  | "PHOTO_PRINT"
  | "WRITING"
  | "QUALITY_CHECK"
  | "PACKING"
  | "READY_FOR_DISPATCH";

export interface QualityChecklistDto {
  correctFlavor: boolean;
  correctWeight: boolean;
  customizationVerified: boolean;
  icingMessageVerified: boolean;
  photoVerified: boolean;
  passed: boolean;
}

export interface KitchenTicketDto {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  currentStation: KitchenStation;
  priorityScore: number;
  assignedStaff?: {
    bakerId?: string;
    decoratorId?: string;
    packerId?: string;
  };
  preparationTimer: {
    estimatedMinutes: number;
    startedAt?: string;
    completedAt?: string;
    actualMinutes?: number;
  };
  qualityCheck?: QualityChecklistDto;
  itemsSummary: { productTitle: string; variantSku: string; quantity: number; icingMessage?: string; photoUrl?: string }[];
  createdAt: string;
}

export class KitchenService {
  private tickets: Map<string, KitchenTicketDto> = new Map();

  async createKitchenTicket(orderData: {
    orderId: string;
    orderNumber: string;
    branchId: string;
    deliverySlotId: "EXPRESS_45MIN" | "STANDARD" | "MIDNIGHT";
    items: { productTitle: string; variantSku: string; quantity: number; icingMessage?: string; photoUrl?: string }[];
  }): Promise<{ ticket: KitchenTicketDto; outboxEvent: any }> {
    const ticketId = `kds_tkt_${Date.now()}`;

    let priorityScore = 50;
    if (orderData.deliverySlotId === "EXPRESS_45MIN") priorityScore = 100;
    else if (orderData.deliverySlotId === "MIDNIGHT") priorityScore = 90;

    const ticket: KitchenTicketDto = {
      id: ticketId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      branchId: orderData.branchId,
      currentStation: "ORDER_RECEIVED",
      priorityScore,
      preparationTimer: {
        estimatedMinutes: 30,
      },
      itemsSummary: orderData.items,
      createdAt: new Date().toISOString(),
    };

    this.tickets.set(ticketId, ticket);

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "KitchenTicketCreated",
      aggregateId: ticketId,
      payload: { ticketId, orderId: orderData.orderId, branchId: orderData.branchId, priorityScore },
    });

    return { ticket, outboxEvent };
  }

  async advanceStation(ticketId: string, targetStation: KitchenStation, staffId?: string): Promise<{ ticket: KitchenTicketDto; outboxEvent: any }> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error("Kitchen ticket not found");

    if (targetStation === "PREPARATION" && !ticket.preparationTimer.startedAt) {
      ticket.preparationTimer.startedAt = new Date().toISOString();
      if (staffId) {
        ticket.assignedStaff = { ...ticket.assignedStaff, bakerId: staffId };
      }
    }

    if (targetStation === "PACKING") {
      if (!ticket.qualityCheck || !ticket.qualityCheck.passed) {
        throw new Error("Mandatory Quality Control (QA) checklist must pass before moving to PACKING");
      }
    }

    if (targetStation === "READY_FOR_DISPATCH") {
      ticket.preparationTimer.completedAt = new Date().toISOString();
      const start = new Date(ticket.preparationTimer.startedAt || ticket.createdAt).getTime();
      ticket.preparationTimer.actualMinutes = Math.round((Date.now() - start) / 60000);
    }

    ticket.currentStation = targetStation;

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: targetStation === "READY_FOR_DISPATCH" ? "ReadyForDispatch" : `KitchenStation_${targetStation}`,
      aggregateId: ticketId,
      payload: { ticketId, orderId: ticket.orderId, currentStation: targetStation },
    });

    return { ticket, outboxEvent };
  }

  async recordQualityControl(ticketId: string, check: Omit<QualityChecklistDto, "passed">): Promise<KitchenTicketDto> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error("Kitchen ticket not found");

    const passed = check.correctFlavor && check.correctWeight && check.customizationVerified && check.icingMessageVerified && check.photoVerified;
    ticket.qualityCheck = { ...check, passed };
    ticket.currentStation = "QUALITY_CHECK";

    return ticket;
  }

  async getKitchenQueue(branchId: string): Promise<KitchenTicketDto[]> {
    return Array.from(this.tickets.values())
      .filter((t) => t.branchId === branchId && t.currentStation !== "READY_FOR_DISPATCH")
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }
}
