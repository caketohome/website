import { Controller, Get, Post, Param } from "@nestjs/common";
import { KitchenService } from "./kitchen.service";

@Controller("api/v1/kitchen")
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get("kot/:orderId")
  async getKot(@Param("orderId") orderId: string) {
    return await this.kitchenService.getKotByOrderId(orderId);
  }

  @Post("kot/:orderId/reprint")
  async reprintKot(@Param("orderId") orderId: string) {
    return await this.kitchenService.reprintKot(orderId);
  }
}

