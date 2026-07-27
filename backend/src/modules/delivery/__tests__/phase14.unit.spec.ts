import DeliveryModuleService from "../service";

describe("Phase 14: Delivery Enhancements Unit Tests", () => {
  let service: any;
  let deliveriesStore: any[];
  let partnersStore: any[];
  let profilesStore: any[];
  let walletsStore: any[];
  let transactionsStore: any[];
  let attendanceStore: any[];
  let locationsStore: any[];
  let junctionStore: any[];

  beforeEach(() => {
    deliveriesStore = [];
    partnersStore = [];
    profilesStore = [];
    walletsStore = [];
    transactionsStore = [];
    attendanceStore = [];
    locationsStore = [];
    junctionStore = [];

    const dependencies = {};
    service = new (DeliveryModuleService as any)(dependencies, {});

    // Stub MedusaService models CRUD operations
    service.createDriverAttendances = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `drvatt_${i + 1}`, ...x, created_at: new Date() }));
      attendanceStore.push(...c);
      return c;
    });
    service.listDriverAttendances = jest.fn(async (sel) => {
      return attendanceStore.filter((x) => !sel || !sel.partner_id || x.partner_id === sel.partner_id);
    });
    service.updateDriverAttendances = jest.fn(async (args) => {
      const match = attendanceStore.find((x) => x.id === args.id);
      if (match) Object.assign(match, args);
      return [match];
    });

    service.createDriverWallets = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `drvwal_${i + 1}`, ...x }));
      walletsStore.push(...c);
      return c;
    });
    service.listDriverWallets = jest.fn(async (sel) => {
      return walletsStore.filter((x) => !sel.partner_id || x.partner_id === sel.partner_id);
    });
    service.updateDriverWallets = jest.fn(async (args) => {
      const match = walletsStore.find((x) => x.id === args.id);
      if (match) Object.assign(match, args);
      return [match];
    });

    service.createDriverTransactions = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `drvtx_${i + 1}`, ...x }));
      transactionsStore.push(...c);
      return c;
    });
    service.listDriverTransactions = jest.fn(async (sel) => {
      return transactionsStore.filter((x) => !sel.wallet_id || x.wallet_id === sel.wallet_id);
    });

    service.createDriverLocations = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `drvloc_${i + 1}`, ...x }));
      locationsStore.push(...c);
      return c;
    });
    service.listDriverLocations = jest.fn(async () => locationsStore);

    service.listDriverProfiles = jest.fn(async (sel) => {
      return profilesStore.filter((x) => !sel || sel.is_verified === undefined || x.is_verified === sel.is_verified);
    });
    service.retrieveDelivery = jest.fn(async (id) => {
      const match = deliveriesStore.find((x) => x.id === id);
      if (!match) throw new Error("Not found");
      return match;
    });
    service.updateDeliveries = jest.fn(async (args) => {
      const match = deliveriesStore.find((x) => x.id === args.id);
      if (match) Object.assign(match, args);
      return [match];
    });
    service.listDeliveries = jest.fn(async (sel) => {
      return deliveriesStore.filter((x) => !sel || !sel.delivery_partner_id || x.delivery_partner_id === sel.delivery_partner_id);
    });
    service.createDeliveryDeliveryPartners = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `delprt_${i + 1}`, ...x }));
      junctionStore.push(...c);
      return c;
    });
  });

  describe("Driver attendance & shifts", () => {
    test("checks in active driver and checks out logs", async () => {
      const att = await service.checkIn("dlp_1");
      expect(att.status).toBe("active");
      expect(attendanceStore).toHaveLength(1);

      const out = await service.checkOut("dlp_1");
      expect(out.status).toBe("inactive");
      expect(out.checked_out_at).toBeDefined();
    });
  });

  describe("Driver wallets ledger", () => {
    test("credits and debits driver commission transactional history", async () => {
      const credited = await service.creditWallet("dlp_1", 20.0, "credit_delivery");
      expect(credited.balance).toBe("20.00");
      expect(transactionsStore).toHaveLength(1);
      expect(transactionsStore[0].amount).toBe("20.00");

      const debited = await service.debitWallet("dlp_1", 5.0, "debit_payout");
      expect(debited.balance).toBe("15.00");
      expect(transactionsStore).toHaveLength(2);
      expect(transactionsStore[1].amount).toBe("-5.00");
    });
  });

  describe("Live Tracking", () => {
    test("posts coordinates and triggers gps emitter broadcasts", async () => {
      const mockListener = jest.fn();
      DeliveryModuleService.gpsEmitter.on("location", mockListener);

      const log = await service.logDriverLocation("dlp_1", "12.9716", "77.5946");
      expect(log.latitude).toBe("12.9716");
      expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({ latitude: "12.9716" }));

      DeliveryModuleService.gpsEmitter.off("location", mockListener);
    });
  });

  describe("Auto Assignment dispatch rules", () => {
    test("auto assigns delivery to checked-in and verified capacity driver", async () => {
      // Setup delivery
      deliveriesStore.push({ id: "del_1", delivery_status: "pending", delivery_partner_id: null });
      // Setup active driver profile
      profilesStore.push({ id: "drvprof_1", partner_id: "dlp_1", is_verified: true });
      // Check in driver
      await service.checkIn("dlp_1");

      const assigned = await service.autoAssignDelivery("del_1");
      expect(assigned).toBeDefined();
      expect(assigned.partner_id).toBe("dlp_1");
      expect(deliveriesStore[0].delivery_partner_id).toBe("dlp_1");
      expect(deliveriesStore[0].delivery_status).toBe("assigned");
      expect(junctionStore).toHaveLength(1);
    });
  });
});
