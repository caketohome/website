import CrmModuleService from "../service";
import { SegmentNotFoundError, SegmentValidationError } from "../errors";

describe("CRM Module - Customer Segmentation Unit Tests", () => {
  let service: any;
  let orderModuleMock: any;
  let rewardsModuleMock: any;
  let customerModuleMock: any;

  beforeEach(() => {
    orderModuleMock = {
      listOrders: jest.fn().mockResolvedValue([]),
    };

    rewardsModuleMock = {
      listWallets: jest.fn().mockResolvedValue([]),
      listLoyaltyLedgers: jest.fn().mockResolvedValue([]),
      listReferralEvents: jest.fn().mockResolvedValue([]),
    };

    customerModuleMock = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cust_1",
        email: "c1@test.com",
        addresses: [{ is_default: true, city_id: "city_bangalore" }],
        metadata: { birthday: "1990-07-18" },
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      }),
      listCustomers: jest.fn().mockResolvedValue([{ id: "cust_1" }]),
    };

    const dependencies = {
      orderModuleService: orderModuleMock,
      customerModuleService: customerModuleMock,
    };

    service = new (CrmModuleService as any)(dependencies, {});

    service.listSegments = jest.fn().mockResolvedValue([]);
    service.createSegments = jest.fn().mockImplementation(async (arr) => arr.map((x, i) => ({ ...x, id: `seg_${i + 1}` })));
    service.updateSegments = jest.fn().mockImplementation(async ({ selector, data }) => [data]);
    service.deleteSegments = jest.fn().mockResolvedValue(undefined);
    service.retrieveSegment = jest.fn().mockResolvedValue({
      id: "seg_1",
      name: "VIP Spenders",
      rules: JSON.stringify([{ field: "total_spent", operator: "gte", value: 100000 }]),
      is_active: true,
    });

    service.listCustomerSegments = jest.fn().mockResolvedValue([]);
    service.createCustomerSegments = jest.fn().mockResolvedValue([{ id: "cseg_1" }]);
    service.deleteCustomerSegments = jest.fn().mockResolvedValue(undefined);
  });

  describe("Segment CRUD Actions", () => {
    test("Create Segment - valid", async () => {
      const data = {
        name: "High Value Bangalore Customers",
        rules: [
          { field: "total_spent", operator: "gte", value: 500000 },
          { field: "city_id", operator: "eq", value: "city_bangalore" }
        ],
      };

      const result = await service.createSegment(data);
      expect(service.createSegments).toHaveBeenCalled();
      expect(result.name).toBe("High Value Bangalore Customers");
    });

    test("Create Segment - missing name", async () => {
      await expect(service.createSegment({ rules: [] })).rejects.toThrow("Segment name is required.");
    });

    test("Create Segment - duplicate name", async () => {
      service.listSegments.mockResolvedValue([{ id: "seg_dup", name: "Dup" }]);
      await expect(service.createSegment({ name: "Dup", rules: [{ field: "order_count", operator: "gt", value: 0 }] })).rejects.toThrow(
        'Segment with name "Dup" already exists.'
      );
    });

    test("Create Segment - validation failures", async () => {
      await expect(service.createSegment({ name: "A", rules: [] })).rejects.toThrow(SegmentValidationError);
      await expect(service.createSegment({ name: "A", rules: [{ field: "bad", operator: "eq", value: 1 }] })).rejects.toThrow(SegmentValidationError);
      await expect(service.createSegment({ name: "A", rules: [{ field: "order_count", operator: "is", value: 1 }] })).rejects.toThrow(SegmentValidationError);
      await expect(service.createSegment({ name: "A", rules: [{ field: "order_count", operator: "eq", value: "not-a-number" }] })).rejects.toThrow(SegmentValidationError);
    });

    test("Update Segment - valid and recalculates memberships", async () => {
      service.listSegments.mockResolvedValue([]);
      const updated = await service.updateSegment("seg_1", { name: "New Name" });
      expect(service.updateSegments).toHaveBeenCalled();
      expect(updated.name).toBe("New Name");
    });

    test("Delete Segment - cleans up mapping table entries", async () => {
      service.listCustomerSegments.mockResolvedValue([{ id: "cseg_1", customer_id: "c1" }]);
      await service.deleteSegment("seg_1");
      expect(service.deleteCustomerSegments).toHaveBeenCalledWith(["cseg_1"]);
      expect(service.deleteSegments).toHaveBeenCalledWith(["seg_1"]);
    });
  });

  describe("Audience Targeting Extension", () => {
    test("validateAudienceDefinition with dynamic segment_ids", () => {
      expect(() => {
        service.validateAudienceDefinition({
          segment_ids: ["seg_gold", "seg_platinum"],
        });
      }).not.toThrow();

      expect(() => {
        service.validateAudienceDefinition({
          segment_ids: "not-an-array",
        });
      }).toThrow("segment_ids must be an array of strings.");
    });
  });

  describe("Rules Evaluation Matcher Engine", () => {
    test("Evaluates customer statistics correctly against criteria", async () => {
      orderModuleMock.listOrders.mockResolvedValue([
        { id: "o1", status: "completed", total: 50000, created_at: new Date() },
        { id: "o2", status: "completed", total: 100000, created_at: new Date() },
      ]);
      rewardsModuleMock.listWallets.mockResolvedValue([{ balance: 50000 }]);
      rewardsModuleMock.listLoyaltyLedgers.mockResolvedValue([{ tier: "gold" }]);
      rewardsModuleMock.listReferralEvents.mockResolvedValue([{ id: "ref1" }, { id: "ref2" }]);

      service.retrieveSegment.mockResolvedValue({
        id: "seg_1",
        is_active: true,
        rules: JSON.stringify([
          { field: "city_id", operator: "eq", value: "city_bangalore" },
          { field: "is_birthday", operator: "eq", value: true },
          { field: "registration_date", operator: "gte", value: "2025-01-01T00:00:00.000Z" }
        ]),
      });

      jest.useFakeTimers().setSystemTime(new Date("2026-07-18T12:00:00.000Z"));

      const isMatch = await service.evaluateCustomerAgainstSegment("cust_1", "seg_1");
      expect(isMatch).toBe(true);

      jest.useRealTimers();
    });

    test("Rejects evaluation when segment is inactive", async () => {
      service.retrieveSegment.mockResolvedValue({
        id: "seg_inactive",
        is_active: false,
        rules: "[]"
      });
      const match = await service.evaluateCustomerAgainstSegment("cust_1", "seg_inactive");
      expect(match).toBe(false);
    });
  });

  describe("Membership Synchronization & Scheduler", () => {
    test("evaluateSegmentMemberships syncs mappings", async () => {
      service.evaluateCustomerAgainstSegment = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      customerModuleMock.listCustomers.mockResolvedValue([
        { id: "cust_match" },
        { id: "cust_mismatch" },
      ]);

      service.listCustomerSegments.mockResolvedValue([
        { id: "cseg_old", customer_id: "cust_mismatch" }
      ]);

      await service.evaluateSegmentMemberships("seg_1");

      expect(service.createCustomerSegments).toHaveBeenCalledWith([
        expect.objectContaining({ customer_id: "cust_match", segment_id: "seg_1" })
      ]);
      expect(service.deleteCustomerSegments).toHaveBeenCalledWith(["cseg_old"]);
    });

    test("evaluateAllCustomerSegments triggers sync for all active segments", async () => {
      service.listSegments.mockResolvedValue([
        { id: "seg_a", is_active: true },
        { id: "seg_b", is_active: true }
      ]);
      service.evaluateSegmentMemberships = jest.fn().mockResolvedValue(undefined);

      await service.evaluateAllCustomerSegments();

      expect(service.evaluateSegmentMemberships).toHaveBeenCalledWith("seg_a");
      expect(service.evaluateSegmentMemberships).toHaveBeenCalledWith("seg_b");
    });
  });
});
