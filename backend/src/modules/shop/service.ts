import { MedusaService } from "@medusajs/utils";
import {
  Shop,
  ShopManager,
  City,
  BranchRegion,
  Branch,
  BranchStaff,
  BranchSettings,
  BranchInventory,
  InventoryTransfer,
  BranchPrice,
  BranchCapacity,
  SlotReservation,
} from "./models";

// Distance calculation abstraction layer to allow pluggable third-party services in the future
export interface DistanceProvider {
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number>;
}

export class HaversineDistanceProvider implements DistanceProvider {
  async calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }
}

class ShopModuleService extends MedusaService({
  Shop,
  ShopManager,
  City,
  BranchRegion,
  Branch,
  BranchStaff,
  BranchSettings,
  BranchInventory,
  InventoryTransfer,
  BranchPrice,
  BranchCapacity,
  SlotReservation,
}) {
  protected distanceProvider: DistanceProvider;
  private locks?: Map<string, Promise<void>>;

  private async acquireLock(key: string): Promise<() => void> {
    if (!this.locks) {
      this.locks = new Map();
    }
    let resolveLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    const existingLock = this.locks.get(key) || Promise.resolve();
    this.locks.set(key, newLock);
    
    await existingLock;
    return () => {
      resolveLock();
      if (this.locks?.get(key) === newLock) {
        this.locks.delete(key);
      }
    };
  }

  constructor(...args: any[]) {
    super(...args);
    // Standard Haversine provider is initialized by default
    this.distanceProvider = new HaversineDistanceProvider();
  }

  // Allow setting a custom provider (e.g. Google Maps, MapmyIndia) later
  setDistanceProvider(provider: DistanceProvider) {
    this.distanceProvider = provider;
  }

  async calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
    return this.distanceProvider.calculateDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * Finds the nearest active branch for the given coordinates that covers the area.
   */
  async findNearestBranch(lat: number, lng: number): Promise<any> {
    return this.selectBestBranch(lat, lng);
  }

  /**
   * Intelligent multi-factor branch selection engine with capacity and failover support.
   */
  async selectBestBranch(
    lat: number,
    lng: number,
    items: { variant_id: string; qty: number }[] = [],
    requiredSlot?: string
  ): Promise<any> {
    const branches = (await this.listBranches(
      { is_open: true },
      { relations: ["settings", "capacity", "inventories"] }
    )) as unknown as any[];

    if (branches.length === 0) return null;

    const scoredBranches: { branch: any; score: number }[] = [];

    for (const branch of branches) {
      // 1. Proximity checks
      const distance = await this.calculateDistance(lat, lng, branch.latitude, branch.longitude);
      const radius = branch.settings?.delivery_radius_km ?? 10;
      if (distance > radius) {
        continue;
      }

      // 2. Stock checks
      let stockMatches = true;
      for (const item of items) {
        const inv = branch.inventories?.find((i: any) => i.variant_id === item.variant_id);
        if (!inv || (inv.quantity - inv.reserved) < item.qty) {
          stockMatches = false;
          break;
        }
      }
      if (!stockMatches) {
        continue;
      }

      // 3. Slot capacity checks
      if (requiredSlot && branch.capacity) {
        const capacity = branch.capacity;
        
        // Parse date for blackout checks
        const targetDate = new Date(requiredSlot);
        if (capacity.blackout_dates) {
          const blackoutDates = typeof capacity.blackout_dates === "string" ? JSON.parse(capacity.blackout_dates) : capacity.blackout_dates;
          const dateStr = targetDate.toISOString().split("T")[0];
          if (blackoutDates.includes(dateStr)) {
            continue; // Date is blacked out
          }
        }

        // Count reservations within the target hour
        const startHour = new Date(targetDate);
        startHour.setMinutes(0, 0, 0);
        const endHour = new Date(targetDate);
        endHour.setMinutes(59, 59, 999);

        const reservationsCount = await (this as any).countSlotReservations({
          branch_id: branch.id,
          slot_time: {
            $gte: startHour,
            $lte: endHour,
          },
          status: "reserved",
        });

        if (reservationsCount >= (capacity.max_cakes_per_hour ?? 10)) {
          continue; // Slot limit reached
        }
      }

      // Proximity score (lower distance gets preferred priority)
      scoredBranches.push({ branch, score: distance });
    }

    if (scoredBranches.length === 0) {
      // Failover fallback: return the closest open branch covering coordinates, regardless of items stock
      let closestBranch = null;
      let minDistance = Infinity;
      for (const branch of branches) {
        const distance = await this.calculateDistance(lat, lng, branch.latitude, branch.longitude);
        const radius = branch.settings?.delivery_radius_km ?? 10;
        if (distance <= radius && distance < minDistance) {
          minDistance = distance;
          closestBranch = branch;
        }
      }
      return closestBranch;
    }

    scoredBranches.sort((a, b) => a.score - b.score);
    return scoredBranches[0].branch;
  }

  /**
   * Verifies if a branch covers a specific coordinate.
   */
  async checkDeliveryCoverage(branchId: string, lat: number, lng: number): Promise<boolean> {
    const [branch] = (await this.listBranches(
      { id: branchId },
      { relations: ["settings"] }
    )) as unknown as any[];

    if (!branch || !branch.is_open) return false;

    const distance = await this.calculateDistance(lat, lng, branch.latitude, branch.longitude);
    const radius = branch.settings?.delivery_radius_km ?? 10;

    return distance <= radius;
  }

  /**
   * Atomic inventory reservation check during checkout.
   */
  async reserveInventory(branchId: string, variantId: string, qty: number): Promise<boolean> {
    const lockKey = `${branchId}:${variantId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const [inv] = (await this.listBranchInventories({
        branch_id: branchId,
        variant_id: variantId,
      })) as unknown as any[];

      if (!inv) return false;
      
      const available = (inv.quantity as number) - (inv.reserved as number);
      if (available < qty) return false;

      await this.updateBranchInventories({
        selector: { id: inv.id as string },
        data: {
          reserved: (inv.reserved as number) + qty,
        },
      });
      return true;
    } finally {
      release();
    }
  }

  /**
   * Release reserved inventory (e.g. after order cancellation or cart timeout).
   */
  async releaseInventory(branchId: string, variantId: string, qty: number): Promise<boolean> {
    const lockKey = `${branchId}:${variantId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const [inv] = (await this.listBranchInventories({
        branch_id: branchId,
        variant_id: variantId,
      })) as unknown as any[];

      if (!inv) return false;

      const newReserved = Math.max(0, (inv.reserved as number) - qty);
      await this.updateBranchInventories({
        selector: { id: inv.id as string },
        data: {
          reserved: newReserved,
        },
      });
      return true;
    } finally {
      release();
    }
  }

  /**
   * Execute stock transfer workflow between branches.
   */
  async executeInventoryTransfer(transferId: string): Promise<boolean> {
    const [transfer] = (await this.listInventoryTransfers(
      { id: transferId },
      { relations: ["from_branch", "to_branch"] }
    )) as unknown as any[];

    if (!transfer || transfer.status !== "pending") return false;

    const fromBranchId = transfer.from_branch?.id;
    const toBranchId = transfer.to_branch.id;
    const variantId = transfer.variant_id as string;
    const productId = transfer.product_id as string;
    const qty = transfer.quantity as number;

    // 1. Deduct from source branch if specified
    if (fromBranchId) {
      const [fromInv] = (await this.listBranchInventories({
        branch_id: fromBranchId,
        variant_id: variantId,
      })) as unknown as any[];

      if (!fromInv || (fromInv.quantity as number) < qty) {
        throw new Error("Insufficient inventory at source branch.");
      }

      await this.updateBranchInventories({
        selector: { id: fromInv.id as string },
        data: {
          quantity: (fromInv.quantity as number) - qty,
        },
      });
    }

    // 2. Add to destination branch
    const [toInv] = (await this.listBranchInventories({
      branch_id: toBranchId,
      variant_id: variantId,
    })) as unknown as any[];

    if (toInv) {
      await this.updateBranchInventories({
        selector: { id: toInv.id as string },
        data: {
          quantity: (toInv.quantity as number) + qty,
        },
      });
    } else {
      await this.createBranchInventories([
        {
          branch_id: toBranchId,
          product_id: productId,
          variant_id: variantId,
          quantity: qty,
          reserved: 0,
        },
      ]);
    }

    // 3. Mark transfer as completed
    await this.updateInventoryTransfers({
      selector: { id: transferId },
      data: {
        status: "completed",
      },
    });

    return true;
  }

  /**
   * Retrieve branch-specific pricing override.
   */
  async getBranchPrice(branchId: string, variantId: string): Promise<any> {
    const [bp] = (await this.listBranchPrices({
      branch_id: branchId,
      variant_id: variantId,
    })) as unknown as any[];

    if (!bp) return null;
    return {
      price: bp.price,
      compare_at_price: bp.compare_at_price,
    };
  }

  /**
   * Temporary Slot Reservation Lock Service.
   */
  async createSlotReservation(
    cartId: string,
    branchId: string,
    slotTime: string
  ): Promise<any> {
    const lockKey = `reservation:${branchId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const targetTime = new Date(slotTime);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock timeout

      // Optimistic capacity validation
      const [capacity] = await this.listBranchCapacities({ branch_id: branchId });
      if (capacity) {
        const startHour = new Date(targetTime);
        startHour.setMinutes(0, 0, 0);
        const endHour = new Date(targetTime);
        endHour.setMinutes(59, 59, 999);

        const reservationsCount = await (this as any).countSlotReservations({
          branch_id: branchId,
          slot_time: {
            $gte: startHour,
            $lte: endHour,
          },
          status: "reserved",
        });

        if (reservationsCount >= (capacity.max_cakes_per_hour ?? 10)) {
          throw new Error("Target capacity slot is fully booked.");
        }
      }

      const reservation = await this.createSlotReservations({
        cart_id: cartId,
        branch_id: branchId,
        slot_time: targetTime,
        status: "reserved",
        expires_at: expiresAt,
      });

      return reservation;
    } finally {
      release();
    }
  }

  /**
   * Confirms a temporary reservation lock.
   */
  async confirmSlotReservation(cartId: string): Promise<boolean> {
    const [res] = await this.listSlotReservations({ cart_id: cartId, status: "reserved" });
    if (!res) return false;

    await this.updateSlotReservations({
      selector: { id: res.id },
      data: { status: "confirmed" },
    });
    return true;
  }

  /**
   * Releases a temporary or confirmed reservation lock.
   */
  async releaseSlotReservation(cartId: string): Promise<boolean> {
    const [res] = await this.listSlotReservations({ cart_id: cartId });
    if (!res) return false;

    await this.updateSlotReservations({
      selector: { id: res.id },
      data: { status: "released" },
    });
    return true;
  }

  /**
   * Expiration Worker executing capacity releases on expired locks.
   */
  async runReservationCleanup(): Promise<number> {
    const expiredReservations = await this.listSlotReservations({
      status: "reserved",
      expires_at: {
        $lt: new Date(),
      },
    });

    for (const res of expiredReservations) {
      await this.updateSlotReservations({
        selector: { id: res.id },
        data: { status: "released" },
      });
    }

    return expiredReservations.length;
  }
}

export default ShopModuleService;
