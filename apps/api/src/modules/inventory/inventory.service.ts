import { InventoryRepository } from "./inventory.repository";
import { ReserveStockInput, ReleaseReservationInput, ConfirmSaleInput } from "./inventory.types";
import { NotFoundError } from "../../core/errors/app-error";

export class InventoryService {
  private repository: InventoryRepository;

  constructor(repository: InventoryRepository = new InventoryRepository()) {
    this.repository = repository;
  }

  async getStockMatrix(branchId?: string, variantId?: string) {
    const items = await this.repository.getStockMatrix(branchId, variantId);
    return {
      items,
      count: items.length,
    };
  }

  async reserveStock(input: ReserveStockInput) {
    return this.repository.reserveStock(input);
  }

  async releaseReservation(input: ReleaseReservationInput) {
    const released = await this.repository.releaseReservation(input.reservationId);
    if (!released) {
      throw new NotFoundError(`Stock reservation '${input.reservationId}' not found or already released.`);
    }
    return { success: true, released_reservation_id: input.reservationId };
  }

  async confirmSale(input: ConfirmSaleInput) {
    const confirmed = await this.repository.confirmSale(input.reservationId);
    if (!confirmed) {
      throw new NotFoundError(`Stock reservation '${input.reservationId}' not found or already confirmed.`);
    }
    return { success: true, confirmed_reservation_id: input.reservationId };
  }
}
