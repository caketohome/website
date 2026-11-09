import { Controller, Post, Body } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";

@Controller("api/v1/delivery")
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post("dispatch")
  async dispatch(@Body() body: { order_id: string; rider_id: string }) {
    return await this.deliveryService.dispatchOrder(body.order_id, body.rider_id);
  }

  @Post("verify-otp")
  async verifyOtp(@Body() body: { order_id: string; otp: string }) {
    return await this.deliveryService.verifyHandoverOtp(body.order_id, body.otp);
  }
}

