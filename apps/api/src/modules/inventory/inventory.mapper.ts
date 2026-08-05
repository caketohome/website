import { StockMatrixItemDTO, StockState } from "./inventory.types";
import { INVENTORY_CONSTANTS } from "./inventory.constants";

export class InventoryMapper {
  static toStockMatrixItemDTO(raw: any): StockMatrixItemDTO {
    if (!raw) return null as any;

    const physical = Number(raw.physicalStock ?? 0);
    const reserved = Number(raw.reservedStock ?? 0);
    const damaged = Number(raw.damagedStock ?? 0);
    const available = Math.max(0, physical - reserved - damaged);

    let stockState: StockState = "IN_STOCK";
    if (available === 0) {
      stockState = "OUT_OF_STOCK";
    } else if (available <= INVENTORY_CONSTANTS.LOW_STOCK_THRESHOLD) {
      stockState = "LOW_STOCK";
    }

    return {
      id: raw.id,
      branchId: raw.branchId || raw.branch_id,
      variantId: raw.variantId || raw.variant_id,
      productTitle: raw.productTitle || raw.product_title || "Bakery Product Variant",
      physicalStock: physical,
      reservedStock: reserved,
      damagedStock: damaged,
      availableStock: available,
      stockState,
      version: Number(raw.version ?? 1),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
