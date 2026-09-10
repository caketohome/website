import { MedusaService } from "@medusajs/utils";
import { EventEmitter } from "events";
import {
  Delivery,
  DeliveryPartner,
  DeliveryDeliveryPartner,
  DeliveryZone,
  DeliverySlot,
  DriverProfile,
  DriverWallet,
  DriverTransaction,
  DriverAttendance,
  DriverLocation,
} from "./models";

class DeliveryModuleService extends MedusaService({
  Delivery,
  DeliveryPartner,
  DeliveryDeliveryPartner,
  DeliveryZone,
  DeliverySlot,
  DriverProfile,
  DriverWallet,
  DriverTransaction,
  DriverAttendance,
  DriverLocation,
}) {
  protected container: any;
  public static gpsEmitter = new EventEmitter();

  constructor(dependencies: any, ...args: any[]) {
    super(dependencies, ...args);
    this.container = dependencies;
  }

  // ── Driver Management Methods ───────────────────────────────────────────

  async checkIn(partnerId: string): Promise<any> {
    const updated = await (this as any).createDriverAttendances([
      {
        partner_id: partnerId,
        status: "active",
        checked_in_at: new Date(),
      },
    ]);
    return updated[0];
  }

  async checkOut(partnerId: string): Promise<any> {
    const [lastAttendance] = await (this as any).listDriverAttendances(
      { partner_id: partnerId },
      { order: { created_at: "DESC" }, take: 1 }
    );

    if (lastAttendance) {
      const updated = await (this as any).updateDriverAttendances({
        id: lastAttendance.id,
        status: "inactive",
        checked_out_at: new Date(),
      });
      return updated[0];
    }
    return null;
  }

  // ── Wallet Ledger Methods ───────────────────────────────────────────────

  async creditWallet(partnerId: string, amount: number, type: string, notes?: string): Promise<any> {
    let [wallet] = await (this as any).listDriverWallets({ partner_id: partnerId });
    if (!wallet) {
      const created = await (this as any).createDriverWallets([{ partner_id: partnerId, balance: "0.0" }]);
      wallet = created[0];
    }

    const currentBal = parseFloat(wallet.balance);
    const newBal = (currentBal + amount).toFixed(2);

    // Update wallet balance
    const updated = await (this as any).updateDriverWallets({
      id: wallet.id,
      balance: newBal,
    });

    // Write Ledger Entry
    await (this as any).createDriverTransactions([
      {
        wallet_id: wallet.id,
        amount: amount.toFixed(2),
        type,
        status: "completed",
        notes: notes || null,
      },
    ]);

    return updated[0];
  }

  async debitWallet(partnerId: string, amount: number, type: string, notes?: string): Promise<any> {
    let [wallet] = await (this as any).listDriverWallets({ partner_id: partnerId });
    if (!wallet) {
      throw new Error(`Wallet for partner ${partnerId} not found.`);
    }

    const currentBal = parseFloat(wallet.balance);
    if (currentBal < amount) {
      throw new Error("Insufficient balance for withdrawal.");
    }
    const newBal = (currentBal - amount).toFixed(2);

    // Update wallet balance
    const updated = await (this as any).updateDriverWallets({
      id: wallet.id,
      balance: newBal,
    });

    // Write Ledger Entry
    await (this as any).createDriverTransactions([
      {
        wallet_id: wallet.id,
        amount: `-${amount.toFixed(2)}`,
        type,
        status: "completed",
        notes: notes || null,
      },
    ]);

    return updated[0];
  }

  // ── GPS Caching & Real-time Streams ─────────────────────────────────────

  async logDriverLocation(partnerId: string, latitude: string, longitude: string): Promise<any> {
    const created = await (this as any).createDriverLocations([
      {
        partner_id: partnerId,
        latitude,
        longitude,
        logged_at: new Date(),
      },
    ]);

    const locationLog = created[0];
    DeliveryModuleService.gpsEmitter.emit("location", locationLog);

    return locationLog;
  }

  // ── Dispatch Auto-Assignment logic ──────────────────────────────────────

  async autoAssignDelivery(deliveryId: string): Promise<any> {
    const delivery = await (this as any).retrieveDelivery(deliveryId).catch(() => null);
    if (!delivery) return null;

    // Load available active driver profiles
    const drivers = await (this as any).listDriverProfiles({ is_verified: true });
    
    // Auto-assignment matching rules
    // Match driver who is:
    // 1. Checked in (active status)
    // 2. Capacity-aware: current active deliveries < 3
    const matchedDriver = await this.findAvailableCapacityDriver(drivers);

    if (matchedDriver) {
      // Assign delivery partner
      await (this as any).updateDeliveries({
        id: deliveryId,
        delivery_partner_id: matchedDriver.partner_id,
        delivery_status: "assigned",
      });

      // Insert junction table record
      await (this as any).createDeliveryDeliveryPartners([
        {
          delivery: deliveryId,
          delivery_partner: matchedDriver.partner_id,
        },
      ]);

      console.info(`Delivery ${deliveryId} auto-assigned to partner ${matchedDriver.partner_id}`);
      return matchedDriver;
    }

    console.info(`No driver available for delivery ${deliveryId}, queued for retry`);
    return null;
  }

  private async findAvailableCapacityDriver(drivers: any[]): Promise<any> {
    if (!drivers || drivers.length === 0) return null;

    const partnerIds = drivers.map((d: any) => d.partner_id).filter(Boolean);
    if (partnerIds.length === 0) return null;

    // Batch query attendances for candidate partners in 1 query (instead of N queries)
    const attendances = (await (this as any).listDriverAttendances(
      { partner_id: partnerIds },
      { order: { created_at: "DESC" } }
    )) || [];

    // Map latest attendance per partner
    const latestAttendanceByPartner = new Map<string, any>();
    for (const att of attendances) {
      if (!latestAttendanceByPartner.has(att.partner_id)) {
        latestAttendanceByPartner.set(att.partner_id, att);
      }
    }

    const activeDrivers = drivers.filter((d: any) => {
      const att = latestAttendanceByPartner.get(d.partner_id);
      return att && att.status === "active";
    });

    if (activeDrivers.length === 0) return null;

    // Batch query active jobs for active candidate drivers in 1 query (instead of N queries)
    const activePartnerIds = activeDrivers.map((d: any) => d.partner_id);
    const activeJobs = (await (this as any).listDeliveries({
      delivery_partner_id: activePartnerIds,
      delivery_status: ["assigned", "claimed", "picked_up"],
    })) || [];

    const jobCountByPartner = new Map<string, number>();
    for (const job of activeJobs) {
      const pid = job.delivery_partner_id as string;
      jobCountByPartner.set(pid, (jobCountByPartner.get(pid) || 0) + 1);
    }

    // Match first driver with available capacity (cap = 3 orders)
    for (const d of activeDrivers) {
      const count = jobCountByPartner.get(d.partner_id) || 0;
      if (count < 3) {
        return d;
      }
    }
    return null;
  }

  /**
   * Automatic driver dispatch reassignment engine if driver declines or times out (5 min SLA).
   */
  async handleDriverReassignment(deliveryId: string, decliningPartnerId?: string): Promise<any> {
    const delivery = await (this as any).retrieveDelivery(deliveryId).catch(() => null);
    if (!delivery) return null;

    // Load available drivers excluding declining partner
    const drivers = await (this as any).listDriverProfiles({ is_verified: true });
    const eligibleDrivers = drivers.filter((d: any) => d.partner_id !== decliningPartnerId);

    const replacementDriver = await this.findAvailableCapacityDriver(eligibleDrivers);
    if (replacementDriver) {
      await (this as any).updateDeliveries({
        id: deliveryId,
        delivery_partner_id: replacementDriver.partner_id,
        delivery_status: "assigned",
      });
      return replacementDriver;
    }

    return null;
  }

  // ── 5-Tier Branch & Delivery Resolution Engine ──────────────────────────────
  // Tier 1: Manual Override > Tier 2: Polygon Map Fence > Tier 3: Exact PIN Code > Tier 4: Radius Match > Tier 5: Default Branch
  async resolveBranchAndDeliveryDetails(input: {
    pincode?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  }): Promise<{
    branch_id: string;
    delivery_fee: number;
    estimated_delivery_minutes: number;
    delivery_zone_id: string | null;
    resolution_tier: string;
    is_serviceable?: boolean;
    location_name?: string;
    pincode?: string;
  }> {
    const zones: any[] = await (this as any).listDeliveryZones(
      { is_serviceable: true },
      { order: { priority: "DESC" } }
    ).catch(() => []);

    const targetPincode = input.pincode?.trim();
    const lat = typeof input.latitude === "number" ? input.latitude : undefined;
    const lng = typeof input.longitude === "number" ? input.longitude : undefined;

    // Tier 1: Manual Override
    if (targetPincode) {
      const overrideZone = zones.find(
        (z) => z.pincode === targetPincode && z.manual_override_branch_id
      );
      if (overrideZone) {
        return {
          branch_id: overrideZone.manual_override_branch_id,
          delivery_fee: overrideZone.delivery_fee || 0,
          estimated_delivery_minutes: overrideZone.estimated_delivery_minutes || 45,
          delivery_zone_id: overrideZone.id,
          resolution_tier: "Tier 1 (Manual Override)",
          is_serviceable: true,
          pincode: targetPincode,
        };
      }
    }

    // Tier 2: Polygon Map-Fence Match (Point-in-Polygon with Exclusion Check)
    if (lat !== undefined && lng !== undefined) {
      // Sort zones by explicit priority DESC
      const polygonCandidates = zones.filter((z) => z.polygon_coordinates && z.branch_id);
      for (const z of polygonCandidates) {
        try {
          const coords = typeof z.polygon_coordinates === "string" ? JSON.parse(z.polygon_coordinates) : z.polygon_coordinates;
          if (Array.isArray(coords) && this.isPointInPolygon(lat, lng, coords)) {
            // Check exclusion polygons if configured
            if (z.exclusion_polygons) {
              const exclusions = typeof z.exclusion_polygons === "string" ? JSON.parse(z.exclusion_polygons) : z.exclusion_polygons;
              if (Array.isArray(exclusions) && exclusions.some((ex: any[]) => this.isPointInPolygon(lat, lng, ex))) {
                continue; // Point is inside an excluded subregion
              }
            }

            return {
              branch_id: z.branch_id,
              delivery_fee: z.delivery_fee ?? 49,
              estimated_delivery_minutes: z.estimated_delivery_minutes ?? 40,
              delivery_zone_id: z.id,
              resolution_tier: "Tier 2 (Polygon Map-Fence)",
              is_serviceable: true,
              location_name: z.name || "Delivery Zone",
            };
          }
        } catch {
          // Continue to next candidate
        }
      }
    }

    // Tier 3: Exact PIN Code Match
    if (targetPincode) {
      const pinZone = zones.find((z) => (z.pincode === targetPincode || (Array.isArray(z.pincodes) && z.pincodes.includes(targetPincode))) && z.branch_id);
      if (pinZone) {
        return {
          branch_id: pinZone.branch_id,
          delivery_fee: pinZone.delivery_fee ?? 49,
          estimated_delivery_minutes: pinZone.estimated_delivery_minutes ?? 45,
          delivery_zone_id: pinZone.id,
          resolution_tier: "Tier 3 (Exact PIN Code)",
          is_serviceable: true,
          pincode: targetPincode,
        };
      }
    }

    // Tier 4: Radius Match (if GPS coordinates provided)
    if (lat !== undefined && lng !== undefined) {
      let closestBranchZone = null;
      let minDistance = Infinity;

      for (const z of zones) {
        if (z.center_latitude && z.center_longitude && (z.radius_km || z.max_km) && z.branch_id) {
          const radiusLimit = z.radius_km || z.max_km || 10;
          const dist = this.calculateHaversineDistance(
            lat,
            lng,
            z.center_latitude,
            z.center_longitude
          );
          if (dist <= radiusLimit && dist < minDistance) {
            minDistance = dist;
            closestBranchZone = z;
          }
        }
      }

      if (closestBranchZone) {
        return {
          branch_id: closestBranchZone.branch_id,
          delivery_fee: closestBranchZone.delivery_fee ?? 49,
          estimated_delivery_minutes: closestBranchZone.estimated_delivery_minutes ?? 45,
          delivery_zone_id: closestBranchZone.id,
          resolution_tier: `Tier 4 (Radius Match ${minDistance.toFixed(1)}km)`,
          is_serviceable: true,
          location_name: closestBranchZone.name || `Service Zone (${minDistance.toFixed(1)}km)`,
        };
      }

      throw new Error("Out of delivery range. The delivery location exceeds the serviceable radius of our branches.");
    }

    // If a pincode was explicitly provided but matched no zone
    if (targetPincode) {
      throw new Error(`Pincode ${targetPincode} is outside our current bakery delivery coverage zone.`);
    }

    // Tier 5: Default Fallback Branch (Only when no location inputs were provided)
    const defaultZone = zones.find((z) => z.branch_id) || zones[0];
    const fallbackBranchId = defaultZone?.branch_id || "branch_default";

    return {
      branch_id: fallbackBranchId,
      delivery_fee: defaultZone?.delivery_fee || 49,
      estimated_delivery_minutes: defaultZone?.estimated_delivery_minutes || 50,
      delivery_zone_id: defaultZone?.id || null,
      resolution_tier: "Tier 5 (Default Branch)",
      is_serviceable: true,
    };
  }

  /**
   * Ray-Casting Point-in-Polygon (PIP) Algorithm
   * Authoritatively checks if a (lat, lng) coordinate falls inside a closed geometric polygon.
   */
  public isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
    if (!polygon || polygon.length < 3) return false;
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export default DeliveryModuleService;
export const DELIVERY_MODULE = "deliveryModuleService";
