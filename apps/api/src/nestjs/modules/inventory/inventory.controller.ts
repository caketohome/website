import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { InventoryService } from "./inventory.service";

@Controller("api/v1/inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("stock/:productId")
  async getStock(@Param("productId") productId: string) {
    return await this.inventoryService.getStock(productId);
  }

  @Post("movement")
  async recordMovement(@Body() body: any) {
    return await this.inventoryService.recordMovement(body);
  }
}

