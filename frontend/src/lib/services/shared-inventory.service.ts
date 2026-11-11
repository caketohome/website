/**
 * @deprecated M3 Decommissioned: Shared Inventory Service
 * Cross-store shared inventory has been permanently decommissioned.
 * All store inventory is governed independently via public.branch_inventory.
 */

export class SharedInventoryService {
  static async getAvailableStock(productId: string, variantId?: string): Promise<number> {
    return 0;
  }

  static async listSharedInventory(filters: any = {}): Promise<any[]> {
    return [];
  }

  static async reserveStock(input: any): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "SHARED_INVENTORY_DECOMMISSIONED: Use branch_inventory instead." };
  }

  static async confirmOrderReservation(orderId: string): Promise<void> {
    // No-op for decommissioned shared inventory
  }

  static async releaseReservation(refId: string, reason?: string, actorId?: string, actorRole?: string, client?: any): Promise<{ success: boolean; releasedCount?: number }> {
    return { success: true, releasedCount: 0 };
  }

  static async adjustStock(input: any): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "SHARED_INVENTORY_DECOMMISSIONED: Use branch_inventory instead." };
  }
}
