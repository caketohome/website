import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class InventoryService {
  async getStock(productId: string) {
    if (!productId) {
      throw new BadRequestException("Product ID is required");
    }

    return {
      product_id: productId,
      stock_quantity: 45,
      reserved_quantity: 5,
      available_quantity: 40,
      status: "in_stock",
    };
  }

  async recordMovement(params: {
    productId: string;
    quantity: number;
    direction: "IN" | "OUT";
    movementType: "SALE" | "RESTOCK" | "WASTE";
    referenceId: string;
  }) {
    return {
      success: true,
      movement_id: `inv_mv_${Date.now()}`,
      product_id: params.productId,
      quantity: params.quantity,
      direction: params.direction,
      movement_type: params.movementType,
      reference_id: params.referenceId,
      recorded_at: new Date().toISOString(),
    };
  }
}

