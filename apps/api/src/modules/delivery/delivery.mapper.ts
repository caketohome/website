import { DeliveryZoneDTO } from "./delivery.types";

export class DeliveryMapper {
  static toDeliveryZoneDTO(raw: any): DeliveryZoneDTO {
    if (!raw) return null as any;
    return {
      id: raw.id,
      name: raw.name || "Default Bakery Delivery Zone",
      code: raw.code || `ZONE-${raw.id}`,
      branchId: raw.branchId || raw.branch_id || "br_koramangala_01",
      servicedPincodes: Array.isArray(raw.servicedPincodes) ? raw.servicedPincodes : ["560038", "560034", "560095", "560047"],
      baseDeliveryFee: Number(raw.baseDeliveryFee ?? 49.0),
      freeDeliveryThreshold: Number(raw.freeDeliveryThreshold ?? 500.0),
      estimatedDeliveryMinutes: Number(raw.estimatedDeliveryMinutes ?? 45),
      isExpressAvailable: Boolean(raw.isExpressAvailable ?? true),
      isActive: Boolean(raw.isActive ?? true),
    };
  }
}
