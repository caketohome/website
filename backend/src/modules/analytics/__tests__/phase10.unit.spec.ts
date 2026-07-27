import AnalyticsModuleService from "../service";
import { GET as getGstReportApi } from "../../../api/admin/analytics/reports/gst/route";
import { GET as getLiveStreamApi } from "../../../api/admin/analytics/live/stream/route";
import { GET as getAuditLogsApi } from "../../../api/admin/audit-logs/route";

describe("Analytics Module - Phase 10 Dashboards and SSE Unit Tests", () => {
  let service: any;
  let eventStore: any[];
  let expenseStore: any[];
  let franchiseStore: any[];
  let auditStore: any[];
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    eventStore = [];
    expenseStore = [];
    franchiseStore = [];
    auditStore = [];

    const dependencies = {
      query: {
        graph: jest.fn().mockResolvedValue({
          data: [
            {
              id: "branch_1",
              name: "Koramangala Branch",
              deliveries: [
                {
                  order: {
                    id: "ord_1",
                    total: 100000, // INR 1000.00
                    status: "completed",
                    created_at: new Date(),
                  },
                },
              ],
            },
          ],
        }),
      },
    };

    service = new (AnalyticsModuleService as any)(dependencies, {});

    service.listAnalyticsEvents = jest.fn(async (sel: any) => eventStore);
    service.createAnalyticsEvents = jest.fn(async (data: any) => {
      const arr = Array.isArray(data) ? data : [data];
      const c = arr.map((e) => ({ ...e, created_at: new Date() }));
      eventStore.push(...c);
      return c;
    });

    service.listExpenses = jest.fn(async () => expenseStore);
    service.listFranchises = jest.fn(async () => franchiseStore);

    mockReq = {
      query: {},
      params: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "analyticsModuleService") return service;
          if (key === "auditModuleService") {
            return {
              query: jest.fn().mockResolvedValue(auditStore),
            };
          }
          return null;
        }),
      },
      auth_context: { actor_id: "admin_1" },
      on: jest.fn(),
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
    };
  });

  describe("GST Calculations & Reports", () => {
    test("calculates GST metrics correctly based on order totals", async () => {
      const report = await service.getGstReport({});
      expect(report.order_revenue).toBe(100000);
      expect(report.gst_collected).toBe(18000); // 18% of 100,000
      expect(report.cgst).toBe(9000);
      expect(report.sgst).toBe(9000);
      expect(report.order_count).toBe(1);
    });

    test("GET /admin/analytics/reports/gst endpoints works with validation checks", async () => {
      await getGstReportApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          report: expect.objectContaining({
            gst_collected: 18000,
          }),
        })
      );
    });

    test("GET /admin/analytics/reports/gst rejects unauthorized requests", async () => {
      delete mockReq.auth_context;
      await getGstReportApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Real-time SSE Live Streaming", () => {
    test("broadcasting tracks events using statically registered emitter", async () => {
      const mockListener = jest.fn();
      AnalyticsModuleService.emitter.on("event", mockListener);

      await service.track({
        event_type: "visitors",
        session_id: "sess_1",
      });

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "visitors",
        })
      );

      AnalyticsModuleService.emitter.off("event", mockListener);
    });

    test("GET /admin/analytics/live/stream establishes event-stream connection", async () => {
      await getLiveStreamApi(mockReq, mockRes);
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          "Content-Type": "text/event-stream",
        })
      );
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining("connected"));
    });
  });

  describe("Audit Logging API", () => {
    test("GET /admin/audit-logs retrieves log database list", async () => {
      auditStore.push({
        id: "aud_1",
        actor_id: "admin_1",
        action: "create",
        entity: "template",
      });

      await getAuditLogsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          logs: expect.any(Array),
        })
      );
    });
  });
});
