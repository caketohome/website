/**
 * CakeToHome Core API - Branches & 5-Field Inventory Domain Service (Phase 1 Feature 3)
 * Manages Branch Operational Controls, 5-Field Inventory, Optimistic Version Locks,
 * 15-Minute Reservation Timers, Audit Logs, and Inter-Branch Stock Transfers.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export interface BranchDto {
  id: string;
  code: string;
  name: string;
  pincodes: string[];
  maxCapacity: number;
  currentLoad: number; // Active orders count
  isOnline: boolean;
  emergencyClosure: boolean;
  acceptOrders: boolean;
  pickupOnly: boolean;
  deliveryOnly: boolean;
}

export interface InventoryItemDto {
  id: string;
  branchId: string;
  variantId: string;
  physicalStock: number;
  reservedStock: number;
  damagedStock: number;
  incomingStock: number;
  version: number;
}

export interface InventoryAuditLogDto {
  id: string;
  branchId: string;
  variantId: string;
  action: "STOCK_ADDED" | "STOCK_REMOVED" | "RESERVATION_CREATED" | "RESERVATION_RELEASED" | "SALE_COMPLETED" | "MANUAL_ADJUSTMENT" | "TRANSFER";
  quantity: number;
  reason: string;
  createdAt: string;
}

export interface StockTransferDto {
  id: string;
  sourceBranchId: string;
  targetBranchId: string;
  variantId: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  createdAt: string;
}

export class InventoryService {
  private branches: Map<string, BranchDto> = new Map();
  private inventory: Map<string, InventoryItemDto> = new Map();
  private auditLogs: InventoryAuditLogDto[] = [];
  private transfers: Map<string, StockTransferDto> = new Map();
  private activeReservations: Map<string, { branchId: string; variantId: string; quantity: number; expiresAt: number }> = new Map();

  constructor() {
    // Seed Koramangala Central & Indiranagar Branches
    const blrCentral: BranchDto = {
      id: "br_koramangala",
      code: "BLR_KORAMANGALA",
      name: "Koramangala Central Kitchen",
      pincodes: ["560034", "560095", "560047"],
      maxCapacity: 25,
      currentLoad: 12,
      isOnline: true,
      emergencyClosure: false,
      acceptOrders: true,
      pickupOnly: false,
      deliveryOnly: false,
    };

    const indiranagar: BranchDto = {
      id: "br_indiranagar",
      code: "BLR_INDIRANAGAR",
      name: "Indiranagar Express Kitchen",
      pincodes: ["560038", "560008"],
      maxCapacity: 20,
      currentLoad: 18,
      isOnline: true,
      emergencyClosure: false,
      acceptOrders: true,
      pickupOnly: false,
      deliveryOnly: false,
    };

    this.branches.set(blrCentral.id, blrCentral);
    this.branches.set(indiranagar.id, indiranagar);

    // Seed 5-field inventory for Koramangala (TRUFFLE-500G)
    const invKor: InventoryItemDto = {
      id: "inv_kor_truffle",
      branchId: "br_koramangala",
      variantId: "var_truffle_half_kg",
      physicalStock: 50,
      reservedStock: 5,
      damagedStock: 2,
      incomingStock: 10,
      version: 1,
    };

    this.inventory.set(`${invKor.branchId}_${invKor.variantId}`, invKor);
  }

  getAvailableStock(branchId: string, variantId: string): number {
    const item = this.inventory.get(`${branchId}_${variantId}`);
    if (!item) return 0;
    return item.physicalStock - item.reservedStock - item.damagedStock;
  }

  async reserveStock(branchId: string, variantId: string, quantity: number, expectedVersion: number): Promise<{ reservationId: string; version: number }> {
    const key = `${branchId}_${variantId}`;
    const item = this.inventory.get(key);
    if (!item) throw new Error("Inventory record not found");

    if (item.version !== expectedVersion) {
      throw new Error(`Optimistic Stock Locking Conflict! Expected version ${expectedVersion}, but found ${item.version}.`);
    }

    const available = item.physicalStock - item.reservedStock - item.damagedStock;
    if (available < quantity) {
      throw new Error(`Insufficient stock available. Requested ${quantity}, available ${available}`);
    }

    // Apply stock reservation
    item.reservedStock += quantity;
    item.version += 1; // Increment optimistic version

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeReservations.set(reservationId, {
      branchId,
      variantId,
      quantity,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15-minute auto-release
    });

    this.logAudit(branchId, variantId, "RESERVATION_CREATED", quantity, `Reserved under ${reservationId}`);

    OutboxPublisherService.createOutboxRecord({
      eventType: "InventoryReserved",
      aggregateId: reservationId,
      payload: { reservationId, branchId, variantId, quantity, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
    });

    return { reservationId, version: item.version };
  }

  async releaseReservation(reservationId: string): Promise<boolean> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return false;

    const item = this.inventory.get(`${res.branchId}_${res.variantId}`);
    if (item) {
      item.reservedStock = Math.max(0, item.reservedStock - res.quantity);
      item.version += 1;
      this.logAudit(res.branchId, res.variantId, "RESERVATION_RELEASED", res.quantity, `Auto-released expired reservation ${reservationId}`);
    }

    this.activeReservations.delete(reservationId);
    return true;
  }

  async confirmSale(reservationId: string): Promise<boolean> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return false;

    const item = this.inventory.get(`${res.branchId}_${res.variantId}`);
    if (item) {
      item.physicalStock = Math.max(0, item.physicalStock - res.quantity);
      item.reservedStock = Math.max(0, item.reservedStock - res.quantity);
      item.version += 1;
      this.logAudit(res.branchId, res.variantId, "SALE_COMPLETED", res.quantity, `Sale confirmed under ${reservationId}`);
    }

    this.activeReservations.delete(reservationId);
    return true;
  }

  async createStockTransfer(sourceBranchId: string, targetBranchId: string, variantId: string, quantity: number): Promise<StockTransferDto> {
    const transferId = `trf_${Date.now()}`;
    const transfer: StockTransferDto = {
      id: transferId,
      sourceBranchId,
      targetBranchId,
      variantId,
      quantity,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    this.transfers.set(transferId, transfer);
    this.logAudit(sourceBranchId, variantId, "TRANSFER", quantity, `Initiated transfer ${transferId} to branch ${targetBranchId}`);
    return transfer;
  }

  resolveBranchForPincode(pincode: string, variantId: string, quantity: number): BranchDto | null {
    const eligibleBranches = Array.from(this.branches.values()).filter((b) => {
      if (!b.isOnline || b.emergencyClosure || !b.acceptOrders) return false;
      if (!b.pincodes.includes(pincode)) return false;
      if (b.currentLoad >= b.maxCapacity) return false;
      const avail = this.getAvailableStock(b.id, variantId);
      return avail >= quantity;
    });

    if (eligibleBranches.length === 0) return null;

    // Route to branch with lowest kitchen load percentage
    eligibleBranches.sort((a, b) => a.currentLoad / a.maxCapacity - b.currentLoad / b.maxCapacity);
    return eligibleBranches[0];
  }

  private logAudit(branchId: string, variantId: string, action: InventoryAuditLogDto["action"], quantity: number, reason: string) {
    this.auditLogs.push({
      id: `log_${Date.now()}_${this.auditLogs.length}`,
      branchId,
      variantId,
      action,
      quantity,
      reason,
      createdAt: new Date().toISOString(),
    });
  }

  getAuditLogs(): InventoryAuditLogDto[] {
    return [...this.auditLogs];
  }
}
