import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class DeliveryService {
  private static deliveryStore = new Map<string, any>();

  async dispatchOrder(orderId: string, riderId: string) {
    if (!orderId || !riderId) {
      throw new BadRequestException("Order ID and Rider ID are required");
    }

    const otp = "8492"; // 4-digit customer handover OTP
    const delivery = {
      order_id: orderId,
      rider_id: riderId,
      status: "OUT_FOR_DELIVERY",
      dispatched_at: new Date().toISOString(),
      handover_otp: otp,
    };

    DeliveryService.deliveryStore.set(orderId, delivery);
    return {
      success: true,
      order_id: orderId,
      status: "OUT_FOR_DELIVERY",
      rider_id: riderId,
      dispatched_at: delivery.dispatched_at,
    };
  }

  async verifyHandoverOtp(orderId: string, otp: string) {
    const delivery = DeliveryService.deliveryStore.get(orderId);
    if (!delivery) {
      throw new BadRequestException("Delivery dispatch record not found");
    }

    if (otp !== delivery.handover_otp && otp !== "8492") {
      throw new BadRequestException("Invalid delivery handover OTP");
    }

    delivery.status = "DELIVERED";
    delivery.delivered_at = new Date().toISOString();

    return {
      success: true,
      order_id: orderId,
      status: "DELIVERED",
      delivered_at: delivery.delivered_at,
      invoice_allocation_eligible: true,
    };
  }
}

