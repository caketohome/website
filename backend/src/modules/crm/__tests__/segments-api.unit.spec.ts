import CrmModuleService from "../service";
import { GET as listSegmentsApi, POST as createSegmentApi } from "../../../api/admin/crm/segments/route";
import { GET as getSegmentApi, POST as updateSegmentApi, DELETE as deleteSegmentApi } from "../../../api/admin/crm/segments/[id]/route";
import { POST as evaluateSegmentApi } from "../../../api/admin/crm/segments/[id]/evaluate/route";
import { GET as getSegmentCustomersApi } from "../../../api/admin/crm/segments/[id]/customers/route";
import { SegmentNotFoundError, SegmentValidationError } from "../errors";

describe("CRM Module - Segments API Route Handlers Unit Tests", () => {
  let service: any;
  let customerModuleMock: any;
  let segmentStore: any[];
  let mappingStore: any[];

  beforeEach(() => {
    segmentStore = [];
    mappingStore = [];

    customerModuleMock = {
      listCustomers: jest.fn().mockResolvedValue([{ id: "cust_1", email: "c1@test.com" }]),
    };

    const dependencies = {
      customerModuleService: customerModuleMock,
    };

    service = new (CrmModuleService as any)(dependencies, {});

    service.listSegments = jest.fn(async (selector: any) => {
      return segmentStore.filter((s) => {
        return Object.entries(selector || {}).every(([k, v]) => s[k] === v);
      });
    });

    service.retrieveSegment = jest.fn(async (id: string) => {
      const matched = segmentStore.find((s) => s.id === id);
      if (!matched) {
        throw new SegmentNotFoundError(id);
      }
      return matched;
    });

    service.createSegments = jest.fn(async (data: any[]) => {
      const created = data.map((s, idx) => ({
        id: `seg_${segmentStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        ...s,
      }));
      segmentStore.push(...created);
      return created;
    });

    service.updateSegments = jest.fn(async (args: any) => {
      const matched = segmentStore.filter((s) => {
        return Object.entries(args.selector).every(([k, v]) => s[k] === v);
      });
      matched.forEach((s) => Object.assign(s, args.data, { updated_at: new Date() }));
      return matched;
    });

    service.deleteSegments = jest.fn(async (ids: string[]) => {
      segmentStore = segmentStore.filter((s) => !ids.includes(s.id));
    });

    service.listCustomerSegments = jest.fn(async (selector: any) => {
      return mappingStore.filter((m) => {
        return Object.entries(selector || {}).every(([k, v]) => m[k] === v);
      });
    });

    service.createCustomerSegments = jest.fn(async (arr: any[]) => {
      const created = arr.map((m, idx) => ({ id: `cseg_${Date.now()}_${idx}`, ...m }));
      mappingStore.push(...created);
      return created;
    });

    service.deleteCustomerSegments = jest.fn(async (ids: string[]) => {
      mappingStore = mappingStore.filter((m) => !ids.includes(m.id));
    });

    service.evaluateSegmentMemberships = jest.fn().mockResolvedValue(undefined);
    service.getSegment = jest.fn(async (id: string) => {
      return service.retrieveSegment(id);
    });
    service.createSegment = jest.fn(async (data: any) => {
      if (!data.name) throw new SegmentValidationError("Segment name is required.");
      const rules = typeof data.rules === "string" ? data.rules : JSON.stringify(data.rules || []);
      const [created] = await service.createSegments([{ name: data.name, rules, is_active: true }]);
      return created;
    });
    service.updateSegment = jest.fn(async (id: string, data: any) => {
      const segment = await service.retrieveSegment(id);
      const [updated] = await service.updateSegments({ selector: { id }, data });
      return updated;
    });
    service.deleteSegment = jest.fn(async (id: string) => {
      await service.retrieveSegment(id);
      await service.deleteSegments([id]);
    });
  });

  describe("API Authentication Checks", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        params: { id: "seg_1" },
        body: { name: "VIP Kochi", rules: [] },
        filterableFields: {},
        listConfig: {},
        scope: {
          resolve: jest.fn((key: string) => {
            if (key === "crmModuleService") return service;
            if (key === "customerModuleService" || key === "customer") return customerModuleMock;
            return null;
          }),
        },
        auth_context: { actor_id: "admin_1" },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    test("unauthorized access returns 401", async () => {
      delete mockReq.auth_context;

      await listSegmentsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await evaluateSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getSegmentCustomersApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test("GET /segments lists all segments", async () => {
      segmentStore.push({ id: "seg_1", name: "High Spenders", rules: "[]", is_active: true });

      await listSegmentsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ segments: expect.any(Array) })
      );
    });

    test("POST /segments creates new segment", async () => {
      await createSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(segmentStore).toHaveLength(1);
    });

    test("POST /segments returns 400 on validation failure", async () => {
      delete mockReq.body.name;
      await createSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "SEGMENT_VALIDATION_FAILED" })
      );
    });

    test("GET /segments/:id detail response", async () => {
      segmentStore.push({ id: "seg_1", name: "Spenders", rules: "[]" });
      await getSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ segment: expect.any(Object) })
      );
    });

    test("DELETE /segments/:id deletes segment", async () => {
      segmentStore.push({ id: "seg_1", name: "Temp", rules: "[]" });
      await deleteSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(segmentStore).toHaveLength(0);
    });

    test("POST /segments/:id/evaluate triggers sync", async () => {
      segmentStore.push({ id: "seg_1", name: "Gold", rules: "[]" });
      await evaluateSegmentApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(service.evaluateSegmentMemberships).toHaveBeenCalledWith("seg_1");
    });

    test("GET /segments/:id/customers lists matched users", async () => {
      segmentStore.push({ id: "seg_1", name: "Kochi", rules: "[]" });
      mappingStore.push({ id: "cseg_1", segment_id: "seg_1", customer_id: "cust_1" });

      await getSegmentCustomersApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ customers: expect.any(Array) })
      );
    });
  });
});
