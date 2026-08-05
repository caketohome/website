import { DeliveryRepository } from "./delivery.repository";
import { CheckServiceabilityInput, ReserveSlotInput, CompleteDeliveryInput } from "./delivery.types";
import { NotFoundError } from "../../core/errors/app-error";

export class DeliveryService {
  private repository: DeliveryRepository;

  constructor(repository: DeliveryRepository = new DeliveryRepository()) {
    this.repository = repository;
  }

  async checkServiceability(input: CheckServiceabilityInput) {
    return this.repository.checkServiceability(input);
  }

  async listDeliveryZones() {
    const zones = await this.repository.listDeliveryZones();
    return {
      zones,
      count: zones.length,
    };
  }

  async getDeliveryZoneById(id: string) {
    const zone = await this.repository.findDeliveryZoneById(id);
    if (!zone) {
      throw new NotFoundError(`Delivery zone with identifier '${id}' not found.`);
    }
    return zone;
  }

  async getSlotCapacityGrid(branchId: string, date: string) {
    return this.repository.getSlotCapacityGrid(branchId, date);
  }

  async reserveSlot(input: ReserveSlotInput) {
    return this.repository.reserveSlot(input);
  }

  async listDrivers(branchId?: string) {
    return this.repository.listDrivers(branchId);
  }

  async createDeliveryJob(orderData: { orderId: string; orderNumber: string; branchId: string; street: string; pincode: string }) {
    return this.repository.createDeliveryJob(orderData);
  }

  async completeDelivery(input: CompleteDeliveryInput) {
    return this.repository.completeDelivery(input);
  }
}
