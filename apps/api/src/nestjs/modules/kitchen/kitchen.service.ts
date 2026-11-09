import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class KitchenService {
  private static kotStore = new Map<string, any>();

  async getKotByOrderId(orderId: string) {
    if (KitchenService.kotStore.has(orderId)) {
      return KitchenService.kotStore.get(orderId);
    }

    const kot = {
      order_id: orderId,
      kot_number: `KOT-${orderId.slice(-5).toUpperCase()}`,
      status: "ACTIVE",
      station: "BAKERY_MAIN",
      items: [
        { name: "Belgian Chocolate Truffle Cake", quantity: 1, variant: "1kg" },
      ],
      created_at: new Date().toISOString(),
      reprint_count: 0,
    };

    KitchenService.kotStore.set(orderId, kot);
    return kot;
  }

  async reprintKot(orderId: string) {
    const kot = await this.getKotByOrderId(orderId);
    kot.reprint_count += 1;
    kot.last_reprinted_at = new Date().toISOString();
    return kot;
  }
}

