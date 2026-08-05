import { Request, Response, NextFunction } from "express";
import { OrdersService } from "./orders.service";
import { validateCreateOrderInput, validateUpdateTicketStatusInput, validateIngestEventInput } from "./orders.validator";

export class OrdersController {
  private service: OrdersService;

  constructor(service: OrdersService = new OrdersService()) {
    this.service = service;
  }

  createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idempotencyKeyHeader = (req.headers["x-idempotency-key"] as string) || undefined;
      const input = validateCreateOrderInput(req.body, idempotencyKeyHeader);
      const result = await this.service.createOrder(input);

      const statusCode = result.isIdempotentReplay ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        data: result.order,
        outbox: result.outboxEvent,
        meta: {
          is_idempotent_replay: result.isIdempotentReplay,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  getOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id;
      const order = await this.service.getOrder(orderId);
      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  };

  listCustomerOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = (req.headers["x-customer-id"] as string) || "cus_guest_100";
      const orders = await this.service.listCustomerOrders(customerId);
      return res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      return next(error);
    }
  };

  ingestOrderEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateIngestEventInput(req.body);
      const result = await this.service.ingestOrderEvent(input);
      return res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: result.ticket,
        meta: {
          is_duplicate_event: result.isDuplicate,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  listKitchenTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = req.query.branchId ? String(req.query.branchId).trim() : undefined;
      const status = req.query.status ? String(req.query.status).trim() : undefined;
      const tickets = await this.service.listKitchenTickets(branchId, status);
      return res.status(200).json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateKitchenTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketId = req.params.ticketId;
      const input = validateUpdateTicketStatusInput(req.body);
      const ticket = await this.service.updateKitchenTicketStatus(ticketId, input);
      return res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      return next(error);
    }
  };
}
