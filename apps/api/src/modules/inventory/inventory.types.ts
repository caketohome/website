export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface StockMatrixItemDTOv1 {
  id: string;
  branchId: string;
  variantId: string;
  productTitle: string;
  physicalStock: number;
  reservedStock: number;
  damagedStock: number;
  availableStock: number;
  stockState: StockState;
  version: number;
  updatedAt: string;
}

export type StockMatrixItemDTO = StockMatrixItemDTOv1;

export interface ReserveStockInput {
  branchId: string;
  variantId: string;
  quantity: number;
  expectedVersion?: number;
}

export interface ReleaseReservationInput {
  reservationId: string;
}

export interface ConfirmSaleInput {
  reservationId: string;
}

export interface InventoryAuditLogDTOv1 {
  id: string;
  branchId: string;
  variantId: string;
  action: "STOCK_ADDED" | "RESERVATION_CREATED" | "RESERVATION_RELEASED" | "SALE_COMPLETED" | "MANUAL_ADJUSTMENT";
  quantity: number;
  reason: string;
  createdAt: string;
}
