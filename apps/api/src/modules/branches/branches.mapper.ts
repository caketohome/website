import { BranchDTO } from "./branches.types";

export class BranchMapper {
  static toBranchDTO(raw: any): BranchDTO {
    if (!raw) return null as any;
    const addr = raw.address || {};
    return {
      id: raw.id,
      name: raw.name || "CakeToHome Bakery Branch",
      code: raw.code || `BR-${raw.id}`,
      address: {
        street: addr.street || "100 Feet Road",
        locality: addr.locality || "Koramangala",
        city: addr.city || "Bengaluru",
        pincode: addr.pincode || "560038",
      },
      contactPhone: raw.contactPhone || raw.phone || "+919876543210",
      managerName: raw.managerName || "Chef Vikram",
      operatingHours: raw.operatingHours || "08:00 AM - 11:30 PM",
      servicedPincodes: Array.isArray(raw.servicedPincodes) ? raw.servicedPincodes : ["560038", "560034", "560095", "560047"],
      isActive: Boolean(raw.isActive ?? true),
      isCentralKitchen: Boolean(raw.isCentralKitchen ?? false),
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    };
  }
}
