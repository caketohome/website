import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import crypto from "crypto";

@Injectable()
export class OrdersService {
  async createOrder(payload: any, userId: string) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new BadRequestException("Order must contain at least one item");
    }

    const orderId = `ord_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const orderNumber = `CTH-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const subtotal = payload.items.reduce(
      (sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const taxTotal = Number((subtotal * 0.05).toFixed(2));
    const grandTotal = Number((subtotal + taxTotal).toFixed(2));

    const order = {
      id: orderId,
      order_number: orderNumber,
      customer_id: userId,
      branch_id: payload.branch_id || "branch_koramangala",
      status: "pending",
      payment_status: "pending",
      payment_method: payload.payment_method || "CASHFREE",
      subtotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
      currency_code: "INR",
      items: payload.items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        note: "Order created via NestJS Backend",
        delivery_slot: payload.delivery_slot_id || "slot_morning",
        delivery_date: payload.delivery_date || new Date().toISOString().slice(0, 10),
      },
    };

    return order;
  }

  async getOrderById(orderId: string) {
    if (!orderId) {
      throw new NotFoundException("Order ID is required");
    }

    return {
      id: orderId,
      order_number: `CTH-${new Date().getFullYear()}-000001`,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "CASHFREE",
      subtotal: 500,
      tax_total: 25,
      grand_total: 525,
      currency_code: "INR",
      created_at: new Date().toISOString(),
    };
  }
}

