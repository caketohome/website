import ShopModuleService from "../service";

function createMockService() {
  const service = Object.create(ShopModuleService.prototype) as ShopModuleService;
  (service as any).distanceProvider = new (require("../service").HaversineDistanceProvider)();

  const branchesStore: any[] = [];
  const settingsStore: any[] = [];
  const inventoryStore: any[] = [];
  const transfersStore: any[] = [];
  const pricesStore: any[] = [];
  const capacityStore: any[] = [];
  const reservationsStore: any[] = [];

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
      const records = inventoryStore.filter((i) =>
        Object.entries(args.selector).every(([k, v]) => i[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
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
    listBranchPrices: jest.fn(async (selector: any) => {
      return pricesStore.filter((p) =>
        Object.entries(selector).every(([k, v]) => p[k] === v)
      );
    }),
    createBranchPrices: jest.fn(async (data: any[]) => {
      const created = data.map((p, idx) => ({
        id: `brprc_${pricesStore.length + idx + 1}`,
        ...p,
      }));
      pricesStore.push(...created);
      return created;
    }),
    updateBranchPrices: jest.fn(async (args: any) => {
      const records = pricesStore.filter((p) =>
        Object.entries(args.selector).every(([k, v]) => p[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listBranchCapacities: jest.fn(async (selector: any) => {
      return capacityStore.filter((c) =>
        Object.entries(selector).every(([k, v]) => c[k] === v)
      );
    }),
    createBranchCapacities: jest.fn(async (data: any[]) => {
      const created = data.map((c, idx) => ({
        id: `brcap_${capacityStore.length + idx + 1}`,
        ...c,
      }));
      capacityStore.push(...created);
      return created;
    }),
    listSlotReservations: jest.fn(async (selector: any) => {
      return reservationsStore.filter((r) => {
        return Object.entries(selector).every(([k, v]) => {
          if (k === "expires_at" && typeof v === "object" && v !== null) {
            const expires = new Date(r.expires_at);
            if ("$lt" in v) {
              return expires < (v as any).$lt;
            }
          }
          return r[k] === v;
        });
      });
    }),
    createSlotReservations: jest.fn(async (data: any) => {
      const single = Array.isArray(data) ? data[0] : data;
      const created = {
        id: `slotres_${reservationsStore.length + 1}`,
        ...single,
      };
      reservationsStore.push(created);
      return created;
    }),
    updateSlotReservations: jest.fn(async (args: any) => {
      const records = reservationsStore.filter((r) =>
        Object.entries(args.selector).every(([k, v]) => r[k] === v)
      );
      records.forEach((rec) => Object.assign(rec, args.data));
      return records;
    }),
    countSlotReservations: jest.fn(async (selector: any) => {
      return reservationsStore.filter((r) => {
        return Object.entries(selector).every(([k, v]) => {
          if (k === "slot_time" && typeof v === "object" && v !== null) {
            const time = new Date(r.slot_time);
            if ("$gte" in v && "$lte" in v) {
              return time >= (v as any).$gte && time <= (v as any).$lte;
            }
          }
          return r[k] === v;
        });
      }).length;
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
      capacityStore,
      reservationsStore,
    },
  };
}

describe("ShopModuleService - Multi-Branch Operations", () => {
  it("calculates distance between coordinates using Haversine formula", async () => {
    const { service } = createMockService();
    // Connaught Place, Delhi (28.6304, 77.2177)
    // Gurgaon Cyber City (28.4950, 77.0898)
    // Distance is roughly ~19.5 km
    const dist = await service.calculateDistance(28.6304, 77.2177, 28.4950, 77.0898);
    expect(dist).toBeGreaterThan(18);
    expect(dist).toBeLessThan(21);
  });

  it("finds the nearest active branch covering the coordinates", async () => {
    const { service, stores } = createMockService();
    
    // Create Gurgaon branch
    const [gurgaon] = await service.createBranches([
      { name: "Gurgaon", latitude: 28.4950, longitude: 77.0898, is_open: true },
    ]);
    await service.createBranchSettings([
      { branch_id: gurgaon.id, delivery_radius_km: 15 },
    ]);
    // Wire the settings relation for our memory store list representation
    gurgaon.settings = stores.settingsStore[0];

    // Create Noida branch
    const [noida] = await service.createBranches([
      { name: "Noida", latitude: 28.5355, longitude: 77.3910, is_open: true },
    ]);
    await service.createBranchSettings([
      { branch_id: noida.id, delivery_radius_km: 15 },
    ]);
    noida.settings = stores.settingsStore[1];

    // Query coordinate near Gurgaon (e.g. 28.4900, 77.0800)
    const nearest = await service.findNearestBranch(28.4900, 77.0800);
    expect(nearest).toBeDefined();
    expect(nearest?.name).toBe("Gurgaon");
  });

  it("checks delivery coverage limits correctly", async () => {
    const { service, stores } = createMockService();
    const [branch] = await service.createBranches([
      { name: "Delhi CP", latitude: 28.6304, longitude: 77.2177, is_open: true },
    ]);
    await service.createBranchSettings([
      { branch_id: branch.id, delivery_radius_km: 5 },
    ]);
    branch.settings = stores.settingsStore[0];

    // 1 km away
    const inRange = await service.checkDeliveryCoverage(branch.id, 28.6250, 77.2200);
    expect(inRange).toBe(true);

    // 10 km away
    const outRange = await service.checkDeliveryCoverage(branch.id, 28.5400, 77.2500);
    expect(outRange).toBe(false);
  });

  it("reserves and releases inventory atomically", async () => {
    const { service } = createMockService();
    const branchId = "br_1";
    const variantId = "var_chocolate_1";

    await service.createBranchInventories([
      { branch_id: branchId, product_id: "prod_1", variant_id: variantId, quantity: 10, reserved: 2 },
    ]);

    // Reserve 5 (should succeed, 10 - 2 = 8 available)
    const reserveSuccess = await service.reserveInventory(branchId, variantId, 5);
    expect(reserveSuccess).toBe(true);
    
    // Check updated reserved amount
    const [inv] = await service.listBranchInventories({ branch_id: branchId, variant_id: variantId });
    expect(inv.reserved).toBe(7);

    // Reserve 5 more (should fail, 10 - 7 = 3 available)
    const reserveFail = await service.reserveInventory(branchId, variantId, 5);
    expect(reserveFail).toBe(false);

    // Release 3
    const releaseSuccess = await service.releaseInventory(branchId, variantId, 3);
    expect(releaseSuccess).toBe(true);
    
    const [invAfterRelease] = await service.listBranchInventories({ branch_id: branchId, variant_id: variantId });
    expect(invAfterRelease.reserved).toBe(4);
  });

  it("executes stock transfers between branches", async () => {
    const { service, stores } = createMockService();
    const fromBranchId = "br_source";
    const toBranchId = "br_dest";
    const variantId = "var_cupcake_1";
    const productId = "prod_cupcake";

    // Setup source stock
    await service.createBranchInventories([
      { branch_id: fromBranchId, product_id: productId, variant_id: variantId, quantity: 20 },
    ]);
    // Setup destination stock
    await service.createBranchInventories([
      { branch_id: toBranchId, product_id: productId, variant_id: variantId, quantity: 5 },
    ]);

    // Create transfer request
    const [transfer] = await service.createInventoryTransfers([
      {
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        product_id: productId,
        variant_id: variantId,
        quantity: 10,
        created_by: "admin@email.com",
      },
    ]);
    // Wire the relations mapping for our list retrieval mock
    (transfer as any).from_branch = { id: fromBranchId };
    (transfer as any).to_branch = { id: toBranchId };

    // Execute transfer
    const executeSuccess = await service.executeInventoryTransfer(transfer.id);
    expect(executeSuccess).toBe(true);

    // Check stocks
    const [sourceInv] = await service.listBranchInventories({ branch_id: fromBranchId, variant_id: variantId });
    const [destInv] = await service.listBranchInventories({ branch_id: toBranchId, variant_id: variantId });
    
    expect(sourceInv.quantity).toBe(10);
    expect(destInv.quantity).toBe(15);
    expect(stores.transfersStore[0].status).toBe("completed");
  });

  it("resolves branch price overrides and falls back to null if none exists", async () => {
    const { service } = createMockService();
    const branchId = "br_1";
    const variantId = "var_premium_cake";

    // Test no override
    const noOverride = await service.getBranchPrice(branchId, variantId);
    expect(noOverride).toBeNull();

    // Set override
    await service.createBranchPrices([
      { branch_id: branchId, variant_id: variantId, price: 1500, compare_at_price: 1800 },
    ]);

    const override = await service.getBranchPrice(branchId, variantId);
    expect(override).toBeDefined();
    expect(override.price).toBe(1500);
    expect(override.compare_at_price).toBe(1800);
  });

  it("selectBestBranch evaluates proximity, stock, and slot capacity criteria", async () => {
    const { service } = createMockService();

    // Noida Branch
    const [noida] = await service.createBranches([
      { name: "Noida", latitude: 28.5355, longitude: 77.3910, is_open: true },
    ]);
    await service.createBranchSettings([
      { branch_id: noida.id, delivery_radius_km: 15 },
    ]);
    await service.createBranchCapacities([
      { branch_id: noida.id, max_cakes_per_hour: 2 },
    ]);
    await service.createBranchInventories([
      { branch_id: noida.id, product_id: "p_1", variant_id: "v_1", quantity: 10, reserved: 0 },
    ]);

    // Query coordinate in Noida coverage range
    const best = await service.selectBestBranch(28.5300, 77.3800, [{ variant_id: "v_1", qty: 2 }], "2026-07-20T10:00:00Z");
    expect(best).toBeDefined();
    expect(best.name).toBe("Noida");
  });

  it("selectBestBranch triggers failover fallback when no match satisfies all criteria", async () => {
    const { service } = createMockService();

    // Noida Branch (out of stock)
    const [noida] = await service.createBranches([
      { name: "Noida", latitude: 28.5355, longitude: 77.3910, is_open: true },
    ]);
    await service.createBranchSettings([
      { branch_id: noida.id, delivery_radius_km: 15 },
    ]);
    await service.createBranchInventories([
      { branch_id: noida.id, product_id: "p_1", variant_id: "v_1", quantity: 0 },
    ]);

    // Should failover to return Noida because it covers the proximity coordinates, ignoring the stock mismatch fallback logic
    const best = await service.selectBestBranch(28.5300, 77.3800, [{ variant_id: "v_1", qty: 2 }]);
    expect(best).toBeDefined();
    expect(best.name).toBe("Noida");
  });

  it("manages slot reservations, locking limits, and worker cleanups", async () => {
    const { service, stores } = createMockService();

    const [noida] = await service.createBranches([
      { name: "Noida", latitude: 28.5355, longitude: 77.3910, is_open: true },
    ]);
    await service.createBranchCapacities([
      { branch_id: noida.id, max_cakes_per_hour: 1 },
    ]);

    // Create reservation slot (should succeed)
    const res = await service.reserveSlot("cart_abc", noida.id, "2026-07-20T10:00:00Z");
    expect(res).toBeDefined();
    expect(res.status).toBe("reserved");

    // Second reservation slot at identical hour should fail capacity limits
    await expect(
      service.reserveSlot("cart_xyz", noida.id, "2026-07-20T10:00:00Z")
    ).rejects.toThrow("Target capacity slot is fully booked.");

    // Expire first reservation manually
    stores.reservationsStore[0].expires_at = new Date(Date.now() - 5000); // 5s ago
    const cleaned = await service.runReservationCleanup();
    expect(cleaned).toBe(1);
    expect(stores.reservationsStore[0].status).toBe("released");
  });
});
