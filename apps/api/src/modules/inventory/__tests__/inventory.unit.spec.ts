import { InventoryService } from "../inventory.service";
import { validateReserveStockInput, validateReleaseReservationInput, validateConfirmSaleInput } from "../inventory.validator";

describe("InventoryService Capability 4.2 3-State Stock Matrix Unit Tests", () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
  });

  it("Capability 4.2: should validate reserve stock input parameters", () => {
    expect(() => validateReserveStockInput({})).toThrow("Property 'branchId' is required.");
    expect(() => validateReserveStockInput({ branchId: "br_koramangala_01" })).toThrow("Property 'variantId' is required.");

    const valid = validateReserveStockInput({ branchId: "br_koramangala_01", variantId: "var_truffle_half_kg", quantity: 2 });
    expect(valid.branchId).toBe("br_koramangala_01");
    expect(valid.variantId).toBe("var_truffle_half_kg");
    expect(valid.quantity).toBe(2);
  });

  it("Capability 4.2: should query 3-state stock matrix (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)", async () => {
    const result = await service.getStockMatrix("br_koramangala_01");
    expect(result.items).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);

    const inStock = result.items.find((i) => i.variantId === "var_truffle_half_kg");
    expect(inStock?.stockState).toBe("IN_STOCK");

    const lowStock = result.items.find((i) => i.variantId === "var_strawberry_1kg");
    expect(lowStock?.stockState).toBe("LOW_STOCK");

    const indiranagarResult = await service.getStockMatrix("br_indiranagar_02");
    const outOfStock = indiranagarResult.items.find((i) => i.variantId === "var_truffle_half_kg");
    expect(outOfStock?.stockState).toBe("OUT_OF_STOCK");
  });

  it("Capability 4.2: should reserve stock with optimistic version increment", async () => {
    const res1 = await service.reserveStock({
      branchId: "br_koramangala_01",
      variantId: "var_truffle_half_kg",
      quantity: 2,
    });

    expect(res1.reservationId).toBeDefined();
    expect(res1.stockItem.reservedStock).toBe(4); // 2 seeded + 2 new
    expect(res1.stockItem.version).toBe(2);

    const confirmRes = await service.confirmSale({ reservationId: res1.reservationId });
    expect(confirmRes.success).toBe(true);
  });

  it("Capability 4.2 Optimistic Lock Concurrency: should throw ConflictError on version mismatch", async () => {
    await expect(
      service.reserveStock({
        branchId: "br_koramangala_01",
        variantId: "var_truffle_half_kg",
        quantity: 1,
        expectedVersion: 99, // Stale version
      })
    ).rejects.toThrow("Optimistic Stock Locking Conflict");
  });

  it("Capability 4.2: should release reservation when checkout fails or cancels", async () => {
    const res = await service.reserveStock({
      branchId: "br_koramangala_01",
      variantId: "var_truffle_half_kg",
      quantity: 1,
    });

    const releaseRes = await service.releaseReservation({ reservationId: res.reservationId });
    expect(releaseRes.success).toBe(true);
  });
});
