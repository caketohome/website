import { Controller, Post, Get, Param, Body, Req } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("api/v1/orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || body.customer_id || "usr_guest";
    return await this.ordersService.createOrder(body, userId);
  }

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    return await this.ordersService.getOrderById(id);
  }
}

