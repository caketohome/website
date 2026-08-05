import { InventoryMapper } from "./inventory.mapper";
import { StockMatrixItemDTO, ReserveStockInput } from "./inventory.types";
import { BadRequestError, ConflictError } from "../../core/errors/app-error";

export class InventoryRepository {
  private prisma: any;
  private inMemoryInventory: Map<string, any> = new Map();
  private activeReservations: Map<string, any> = new Map();

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
    // Seed initial demo stock matrix items across branches
    const seedItems = [
      {
        id: "inv_kor_01",
        branchId: "br_koramangala_01",
        variantId: "var_truffle_half_kg",
        productTitle: "Belgian Chocolate Truffle Cake (500g)",
        physicalStock: 25,
        reservedStock: 2,
        damagedStock: 0,
        version: 1,
      },
      {
        id: "inv_kor_02",
        branchId: "br_koramangala_01",
        variantId: "var_strawberry_1kg",
        productTitle: "Fresh Strawberry Gateau (1kg)",
        physicalStock: 4,
        reservedStock: 0,
        damagedStock: 0,
        version: 1,
      },
      {
        id: "inv_ind_01",
        branchId: "br_indiranagar_02",
        variantId: "var_truffle_half_kg",
        productTitle: "Belgian Chocolate Truffle Cake (500g)",
        physicalStock: 0,
        reservedStock: 0,
        damagedStock: 0,
        version: 1,
      },
    ];

    for (const item of seedItems) {
      this.inMemoryInventory.set(`${item.branchId}_${item.variantId}`, item);
    }
  }

  async getStockMatrix(branchId?: string, variantId?: string): Promise<StockMatrixItemDTO[]> {
    if (this.prisma) {
      const where: any = {};
      if (branchId) where.branchId = branchId;
      if (variantId) where.variantId = variantId;
      const rawList = await this.prisma.inventoryItem.findMany({ where });
      return rawList.map(InventoryMapper.toStockMatrixItemDTO);
    }

    let list = Array.from(this.inMemoryInventory.values());
    if (branchId) list = list.filter((i) => i.branchId === branchId);
    if (variantId) list = list.filter((i) => i.variantId === variantId);

    return list.map(InventoryMapper.toStockMatrixItemDTO);
  }

  async reserveStock(input: ReserveStockInput): Promise<{ reservationId: string; stockItem: StockMatrixItemDTO }> {
    const key = `${input.branchId}_${input.variantId}`;
    let item = this.inMemoryInventory.get(key);

    if (!item) {
      // Auto-create initial record if missing
      item = {
        id: `inv_${Date.now()}`,
        branchId: input.branchId,
        variantId: input.variantId,
        productTitle: "Handcrafted Cake Variant",
        physicalStock: 20,
        reservedStock: 0,
        damagedStock: 0,
        version: 1,
      };
      this.inMemoryInventory.set(key, item);
    }

    if (input.expectedVersion !== undefined && item.version !== input.expectedVersion) {
      throw new ConflictError(`Optimistic Stock Locking Conflict! Expected version ${input.expectedVersion}, but current version is ${item.version}.`);
    }

    const available = item.physicalStock - item.reservedStock - item.damagedStock;
    if (available < input.quantity) {
      throw new BadRequestError(`Insufficient stock available at branch '${input.branchId}'. Requested ${input.quantity}, available ${available}.`);
    }

    item.reservedStock += input.quantity;
    item.version += 1; // Increment version lock

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.activeReservations.set(reservationId, {
      reservationId,
      branchId: input.branchId,
      variantId: input.variantId,
      quantity: input.quantity,
      createdAt: new Date().toISOString(),
    });

    return {
      reservationId,
      stockItem: InventoryMapper.toStockMatrixItemDTO(item),
    };
  }

  async releaseReservation(reservationId: string): Promise<boolean> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return false;

    const key = `${res.branchId}_${res.variantId}`;
    const item = this.inMemoryInventory.get(key);
    if (item) {
      item.reservedStock = Math.max(0, item.reservedStock - res.quantity);
      item.version += 1;
    }

    this.activeReservations.delete(reservationId);
    return true;
  }

  async confirmSale(reservationId: string): Promise<boolean> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return false;

    const key = `${res.branchId}_${res.variantId}`;
    const item = this.inMemoryInventory.get(key);
    if (item) {
      item.physicalStock = Math.max(0, item.physicalStock - res.quantity);
      item.reservedStock = Math.max(0, item.reservedStock - res.quantity);
      item.version += 1;
    }

    this.activeReservations.delete(reservationId);
    return true;
  }
}
