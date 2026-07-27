import CrmModuleService from "../service";
import { validateCustomerBlacklistStepHandler, CustomerBlacklistedError } from "../../../workflows/hooks/complete-cart";
import { POST, DELETE, GET } from "../../../api/admin/crm/customers/[id]/blacklist/route";

describe("CRM Module - Blacklist Unit & Integration Tests", () => {
  let service: any;
  let blacklistStore: any[];

  beforeEach(() => {
    blacklistStore = [];

    const dependencies = {};
    service = new (CrmModuleService as any)(dependencies, {});

    // Mock MedusaService generated methods
    service.listCustomerBlacklists = jest.fn(async (selector: any) => {
      return blacklistStore.filter((item) => {
        return Object.entries(selector).every(([k, v]) => item[k] === v);
      });
    });

    service.createCustomerBlacklists = jest.fn(async (data: any[]) => {
      const created = data.map((item, idx) => ({
        id: `blk_${blacklistStore.length + idx + 1}`,
        ...item,
      }));
      blacklistStore.push(...created);
      return created;
    });

    service.updateCustomerBlacklists = jest.fn(async (args: any) => {
      const matched = blacklistStore.filter((item) => {
        return Object.entries(args.selector).every(([k, v]) => item[k] === v);
      });
      matched.forEach((item) => Object.assign(item, args.data));
      return matched;
    });

    service.deleteCustomerBlacklists = jest.fn(async (ids: string[]) => {
      blacklistStore = blacklistStore.filter((item) => !ids.includes(item.id));
    });
  });

  // 1. Service methods tests
  describe("Service Methods", () => {
    it("should successfully blacklist a customer (idempotent)", async () => {
      const customerId = "cust_abc";

      // 1. First blacklist
      const record = await service.blacklistCustomer(customerId, "Fraudulent orders", "admin_1");
      expect(record.customer_id).toBe(customerId);
      expect(record.is_blacklisted).toBe(true);
      expect(record.reason).toBe("Fraudulent orders");
      expect(record.blacklisted_by).toBe("admin_1");
      expect(blacklistStore).toHaveLength(1);

      // 2. Duplicate request (idempotent update)
      const record2 = await service.blacklistCustomer(customerId, "Updated fraud reason", "admin_2");
      expect(record2.customer_id).toBe(customerId);
      expect(record2.reason).toBe("Updated fraud reason");
      expect(record2.blacklisted_by).toBe("admin_2");
      expect(blacklistStore).toHaveLength(1); // Length remains 1 (idempotent)
    });

    it("should check if a customer is blacklisted", async () => {
      const customerId = "cust_xyz";
      expect(await service.isCustomerBlacklisted(customerId)).toBe(false);

      await service.blacklistCustomer(customerId, "Spam", "admin_1");
      expect(await service.isCustomerBlacklisted(customerId)).toBe(true);
    });

    it("should remove a customer from blacklist", async () => {
      const customerId = "cust_removal";

      await service.blacklistCustomer(customerId, "Spam", "admin_1");
      expect(await service.isCustomerBlacklisted(customerId)).toBe(true);

      await service.removeCustomerFromBlacklist(customerId);
      expect(await service.isCustomerBlacklisted(customerId)).toBe(false);
      expect(blacklistStore).toHaveLength(0);
    });
  });

  // 2. Workflow hook step handler tests
  describe("Workflow validation step handler", () => {
    let mockContainer: any;

    beforeEach(() => {
      mockContainer = {
        resolve: jest.fn((key: string) => {
          if (key === "crmModuleService") return service;
          return null;
        }),
      };
    });

    it("should allow checkout for clean customer", async () => {
      const response = await validateCustomerBlacklistStepHandler(
        { customer_id: "cust_clean" },
        { container: mockContainer } as any
      );

      expect(response).toBeDefined();
    });

    it("should throw CustomerBlacklistedError for blacklisted customer", async () => {
      // Blacklist customer first
      await service.blacklistCustomer("cust_dirty", "abuse", "admin_1");

      await expect(
        validateCustomerBlacklistStepHandler(
          { customer_id: "cust_dirty" },
          { container: mockContainer } as any
        )
      ).rejects.toThrow(CustomerBlacklistedError);
    });
  });

  // 3. Admin REST API routes handlers tests
  describe("Admin API Route Handlers", () => {
    let mockReq: any;
    let mockRes: any;
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        graph: jest.fn(),
      };

      mockReq = {
        params: { id: "cust_1" },
        body: { reason: "Abuse" },
        scope: {
          resolve: jest.fn((key: string) => {
            if (key === "query") return mockQuery;
            if (key === "crmModuleService") return service;
            return null;
          }),
        },
        auth_context: { actor_id: "admin_user" },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it("POST /blacklist returns 401 on missing actorId", async () => {
      mockReq.auth_context = null;

      await POST(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Unauthorized") })
      );
    });

    it("POST /blacklist returns 404 for nonexistent customer", async () => {
      mockQuery.graph.mockResolvedValue({ data: [] }); // customer not found

      await POST(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("not found") })
      );
    });

    it("POST /blacklist succeeds for existing customer", async () => {
      mockQuery.graph.mockResolvedValue({ data: [{ id: "cust_1" }] });

      await POST(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ blacklist: expect.any(Object) })
      );
      expect(blacklistStore).toHaveLength(1);
    });

    it("DELETE /blacklist removes customer from blacklist", async () => {
      mockQuery.graph.mockResolvedValue({ data: [{ id: "cust_1" }] });
      await service.blacklistCustomer("cust_1", "fraud", "admin");

      await DELETE(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(blacklistStore).toHaveLength(0);
    });

    it("GET /blacklist returns blacklist status details", async () => {
      mockQuery.graph.mockResolvedValue({ data: [{ id: "cust_1" }] });
      await service.blacklistCustomer("cust_1", "fraud", "admin");

      await GET(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        is_blacklisted: true,
        blacklist: expect.objectContaining({ customer_id: "cust_1" }),
      });
    });
  });
});
