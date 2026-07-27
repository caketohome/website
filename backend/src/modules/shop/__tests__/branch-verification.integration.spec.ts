import ShopModuleService from "../service";

function createMockService() {
  const service = Object.create(ShopModuleService.prototype) as ShopModuleService;
  (service as any).distanceProvider = new (require("../service").HaversineDistanceProvider)();

  const branchesStore: any[] = [];
  const settingsStore: any[] = [];
  const inventoryStore: any[] = [];
  const transfersStore: any[] = [];
  const pricesStore: any[] = [];

  const mocks: any = {
    listBranches: jest.fn(async (selector: any) => {
      return branchesStore.filter((b) =>
        Object.entries(selector).every(([k, v]) => b[k] === v)
      );
    }),
    createBranches: jest.fn(async (data: any[]) => {
      const created = data.map((b, idx) => ({
        id: `br_${branchesStore.length + idx + 1}`,
        is_open: true,
        ...b,
      }));
      branchesStore.push(...created);
      return created;
    }),
    updateBranches: jest.fn(async (args: any) => {
      const records = branchesStore.filter((b) =>
        Object.entries(args.selector).every(([k, v]) => b[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listBranchSettings: jest.fn(async (selector: any) => {
      return settingsStore.filter((s) =>
        Object.entries(selector).every(([k, v]) => s[k] === v)
      );
    }),
    createBranchSettings: jest.fn(async (data: any[]) => {
      const created = data.map((s, idx) => ({
        id: `brset_${settingsStore.length + idx + 1}`,
        ...s,
      }));
      settingsStore.push(...created);
      return created;
    }),
    updateBranchSettings: jest.fn(async (args: any) => {
      const records = settingsStore.filter((s) =>
        Object.entries(args.selector).every(([k, v]) => s[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listBranchInventories: jest.fn(async (selector: any) => {
      return inventoryStore.filter((i) =>
        Object.entries(selector).every(([k, v]) => i[k] === v)
      );
    }),
    createBranchInventories: jest.fn(async (data: any[]) => {
      const created = data.map((i, idx) => ({
        id: `brinv_${inventoryStore.length + idx + 1}`,
        quantity: 0,
        reserved: 0,
        ...i,
      }));
      inventoryStore.push(...created);
      return created;
    }),
    updateBranchInventories: jest.fn(async (args: any) => {
      // Introduce an asynchronous delay to simulate overlapping database concurrency
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
      
      const record = inventoryStore.find((i) => i.id === args.selector.id);
      if (!record) return [];

      if (args.data.reserved !== undefined) {
        const available = record.quantity - record.reserved;
        const delta = args.data.reserved - record.reserved;
        // Concurrent transaction check
        if (delta > available) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }
      Object.assign(record, args.data);
      return [record];
    }),
    listInventoryTransfers: jest.fn(async (selector: any) => {
      return transfersStore.filter((t) =>
        Object.entries(selector).every(([k, v]) => t[k] === v)
      );
    }),
    createInventoryTransfers: jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `invtr_${transfersStore.length + idx + 1}`,
        status: "pending",
        ...t,
      }));
      transfersStore.push(...created);
      return created;
    }),
    updateInventoryTransfers: jest.fn(async (args: any) => {
      const records = transfersStore.filter((t) =>
        Object.entries(args.selector).every(([k, v]) => t[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
  };

  Object.entries(mocks).forEach(([k, v]) => {
    (service as any)[k] = v;
  });

  return {
    service,
    mocks,
    stores: {
      branchesStore,
      settingsStore,
      inventoryStore,
      transfersStore,
      pricesStore,
    },
  };
}

describe("ShopModuleService - Phase 6.7 Enterprise Hardening", () => {
  
  // Benchmark helper
  const measureExecution = async (fn: () => Promise<any>): Promise<{ result: any; latencyMs: number }> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, latencyMs: end - start };
  };

  describe("1. Concurrency & Integrity Verification", () => {
    it("preserves integrity under 10 concurrent stock reservations (race conditions)", async () => {
      const { service } = createMockService();
      const branchId = "br_1";
      const variantId = "var_limited_cupcake";

      await service.createBranchInventories([
        { branch_id: branchId, product_id: "prod_1", variant_id: variantId, quantity: 5, reserved: 0 },
      ]);

      // Trigger 10 parallel reservation calls of 1 unit each (max capacity is 5)
      const reservationPromises = Array.from({ length: 10 }).map(() =>
        service.reserveInventory(branchId, variantId, 1).catch(() => false)
      );

      const results = await Promise.all(reservationPromises);
      const successfulReservations = results.filter(Boolean).length;

      // Verify that exactly 5 reservations succeeded and the rest were rejected
      expect(successfulReservations).toBe(5);

      const [inv] = await service.listBranchInventories({ branch_id: branchId, variant_id: variantId });
      expect(inv.reserved).toBe(5);
    });

    it("verifies transaction rollback behavior on partial checkout booking failures", async () => {
      const { service } = createMockService();
      const branchId = "br_1";

      await service.createBranchInventories([
        { branch_id: branchId, product_id: "prod_1", variant_id: "var_cake", quantity: 10, reserved: 0 },
        { branch_id: branchId, product_id: "prod_2", variant_id: "var_candle", quantity: 0, reserved: 0 }, // Out of stock
      ]);

      const cart = {
        branch_id: branchId,
        items: [
          { variant_id: "var_cake", quantity: 2 },
          { variant_id: "var_candle", quantity: 1 }, // This will fail to reserve
        ],
      };

      // Simulates transactional checkout order placement
      const placeOrder = async () => {
        const reservations: any[] = [];
        try {
          for (const item of cart.items) {
            const success = await service.reserveInventory(cart.branch_id, item.variant_id, item.quantity);
            if (!success) {
              throw new Error("RESERVATION_FAILED");
            }
            reservations.push(item);
          }
          return true;
        } catch (err) {
          // Transaction Rollback logic: release all previously booked items
          for (const res of reservations) {
            await service.releaseInventory(cart.branch_id, res.variant_id, res.quantity);
          }
          return false;
        }
      };

      const checkoutSuccess = await placeOrder();
      expect(checkoutSuccess).toBe(false);

      // Verify that the reserved quantity of var_cake is rolled back to 0
      const [cakeInv] = await service.listBranchInventories({ branch_id: branchId, variant_id: "var_cake" });
      expect(cakeInv.reserved).toBe(0);
    });
  });

  describe("2. Failure Recovery Scenarios", () => {
    it("handles checkout gracefully when a branch is set to unavailable mid-flight", async () => {
      const { service, stores } = createMockService();
      
      const [branch] = await service.createBranches([
        { name: "Gurgaon Cyber City", latitude: 28.4950, longitude: 77.0898, is_open: true },
      ]);
      await service.createBranchSettings([
        { branch_id: branch.id, delivery_radius_km: 15 },
      ]);
      branch.settings = stores.settingsStore[0];

      // Customer coordinates are near Gurgaon
      const customerLat = 28.4900;
      const customerLng = 77.0800;

      // 1. Locate closest branch (should allocate Gurgaon)
      const allocatedBranch = await service.findNearestBranch(customerLat, customerLng);
      expect(allocatedBranch).toBeDefined();
      expect(allocatedBranch?.name).toBe("Gurgaon Cyber City");

      // 2. Simulate branch going offline (owner shuts branch)
      await service.updateBranches({ selector: { id: branch.id }, data: { is_open: false } });

      // 3. Re-verify allocation at checkout (should now return null or throw)
      const postOfflineCheck = await service.findNearestBranch(customerLat, customerLng);
      expect(postOfflineCheck).toBeNull();
    });

    it("restores inventory levels on transfer cancellation", async () => {
      const { service, stores } = createMockService();
      const fromBranch = "br_1";
      const toBranch = "br_2";
      const variantId = "var_chocolate_box";

      await service.createBranchInventories([
        { branch_id: fromBranch, product_id: "p1", variant_id: variantId, quantity: 10, reserved: 0 },
        { branch_id: toBranch, product_id: "p1", variant_id: variantId, quantity: 2, reserved: 0 },
      ]);

      const [transfer] = await service.createInventoryTransfers([
        { from_branch_id: fromBranch, to_branch_id: toBranch, product_id: "p1", variant_id: variantId, quantity: 5 },
      ]);
      (transfer as any).from_branch = { id: fromBranch };
      (transfer as any).to_branch = { id: toBranch };

      // Simulate executing the transfer
      await service.executeInventoryTransfer(transfer.id);

      // Verify intermediate stocks
      const [fromInv] = await service.listBranchInventories({ branch_id: fromBranch, variant_id: variantId });
      const [toInv] = await service.listBranchInventories({ branch_id: toBranch, variant_id: variantId });
      expect(fromInv.quantity).toBe(5);
      expect(toInv.quantity).toBe(7);

      // Cancel transfer and restore stock (Failure recovery)
      const cancelTransfer = async (transferId: string) => {
        const [tr] = await service.listInventoryTransfers({ id: transferId });
        if (tr.status === "completed") {
          // Revert quantities
          const [fInv] = await service.listBranchInventories({ branch_id: tr.from_branch_id, variant_id: tr.variant_id });
          const [tInv] = await service.listBranchInventories({ branch_id: tr.to_branch_id, variant_id: tr.variant_id });

          await service.updateBranchInventories({
            selector: { id: fInv.id },
            data: { quantity: fInv.quantity + tr.quantity },
          });
          await service.updateBranchInventories({
            selector: { id: tInv.id },
            data: { quantity: tInv.quantity - tr.quantity },
          });

          await service.updateInventoryTransfers({
            selector: { id: transferId },
            data: { status: "cancelled" },
          });
        }
      };

      await cancelTransfer(transfer.id);

      // Verify stocks are fully reverted
      const [fromInvReverted] = await service.listBranchInventories({ branch_id: fromBranch, variant_id: variantId });
      const [toInvReverted] = await service.listBranchInventories({ branch_id: toBranch, variant_id: variantId });
      expect(fromInvReverted.quantity).toBe(10);
      expect(toInvReverted.quantity).toBe(2);
    });
  });

  describe("3. Performance Benchmarks", () => {
    it("verifies latencies of core multi-branch calculations and API calls", async () => {
      const { service, stores } = createMockService();
      
      // Setup mock data for lookup
      const [branch] = await service.createBranches([
        { name: "Gurgaon", latitude: 28.4950, longitude: 77.0898, is_open: true },
      ]);
      await service.createBranchSettings([
        { branch_id: branch.id, delivery_radius_km: 15 },
      ]);
      branch.settings = stores.settingsStore[0];

      await service.createBranchInventories([
        { branch_id: branch.id, product_id: "prod_1", variant_id: "var_1", quantity: 10, reserved: 0 },
      ]);

      // 1. Measure Distance Check Latency
      const { latencyMs: distLatency } = await measureExecution(() =>
        service.calculateDistance(28.6304, 77.2177, 28.4950, 77.0898)
      );
      console.log(`[PERFORMANCE] distance calculation latency: ${distLatency.toFixed(3)} ms`);
      expect(distLatency).toBeLessThan(50); // Haversine formula math is sub-millisecond

      // 2. Measure Branch Lookup Latency
      const { latencyMs: lookupLatency } = await measureExecution(() =>
        service.findNearestBranch(28.4900, 77.0800)
      );
      console.log(`[PERFORMANCE] branch lookup latency: ${lookupLatency.toFixed(3)} ms`);
      expect(lookupLatency).toBeLessThan(100);

      // 3. Measure Inventory Reservation Latency
      const { latencyMs: reserveLatency } = await measureExecution(() =>
        service.reserveInventory(branch.id, "var_1", 1)
      );
      console.log(`[PERFORMANCE] inventory reservation latency: ${reserveLatency.toFixed(3)} ms`);
      expect(reserveLatency).toBeLessThan(100);
    });
  });
});
