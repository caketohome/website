import AnalyticsModuleService from "../service";
import sendScheduledReportsJob from "../../../jobs/send-scheduled-reports";
import { GET as retentionApi } from "../../../api/admin/reports/retention/route";
import { GET as roiApi } from "../../../api/admin/reports/campaign-roi/route";
import { GET as staffApi } from "../../../api/admin/reports/staff-performance/route";
import { GET as exportApi } from "../../../api/admin/reports/export/route";
import { GET as schedulesListApi, POST as scheduleCreateApi } from "../../../api/admin/reports/schedules/route";

describe("Analytics Module - Phase 11 Reports & Exports Unit Tests", () => {
  let service: any;
  let scheduleStore: any[];
  let notificationStore: any[];
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    scheduleStore = [];
    notificationStore = [];

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
                    total: 100000,
                    status: "completed",
                    created_at: new Date(),
                  },
                },
              ],
            },
          ],
        }),
      },
      marketingModuleService: {
        listCampaigns: jest.fn().mockResolvedValue([
          {
            id: "camp_1",
            name: "Welcome Campaign",
            coupon_code: "WELCOME10",
            budget: 5000,
          },
        ]),
      },
      deliveryModuleService: {
        listDeliveries: jest.fn().mockResolvedValue([
          {
            id: "del_1",
            delivery_partner_id: "driver_1",
            delivery_status: "delivered",
            created_at: new Date(),
            branch_id: "branch_1",
          },
        ]),
      },
    };

    service = new (AnalyticsModuleService as any)(dependencies, {});

    service.listExpenses = jest.fn(async () => []);
    service.listFranchises = jest.fn(async () => []);

    // Stub MedusaService ReportSchedule methods
    service.listReportSchedules = jest.fn(async () => scheduleStore);
    service.retrieveReportSchedule = jest.fn(async (id: string) => {
      const match = scheduleStore.find(s => s.id === id);
      if (!match) throw new Error("Not found");
      return match;
    });
    service.createReportSchedules = jest.fn(async (arr: any[]) => {
      const created = arr.map((s, idx) => ({ id: `repsch_${idx + 1}`, ...s }));
      scheduleStore.push(...created);
      return created;
    });
    service.updateReportSchedules = jest.fn(async (args: any) => {
      const match = scheduleStore.find(s => s.id === args.selector.id);
      if (match) Object.assign(match, args.data);
      return [match];
    });
    service.deleteReportSchedules = jest.fn(async (ids: string[]) => {
      scheduleStore = scheduleStore.filter(s => !ids.includes(s.id));
    });

    mockReq = {
      query: {},
      params: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "analyticsModuleService") return service;
          return null;
        }),
      },
      auth_context: { actor_id: "admin_1" },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("Customer Retention & Cohorts", () => {
    test("calculates repeat purchase rate correctly", async () => {
      // Mock order data with repeat customer purchases
      service.fetchAnalyticsData = jest.fn().mockResolvedValue({
        orders: [
          { id: "ord_1", customer_id: "cust_1", total: 1000, created_at: new Date() },
          { id: "ord_2", customer_id: "cust_1", total: 1200, created_at: new Date() },
          { id: "ord_3", customer_id: "cust_2", total: 800, created_at: new Date() },
        ],
      });

      const report = await service.getCustomerRetentionReport({});
      expect(report.total_customers).toBe(2);
      expect(report.repeat_customers).toBe(1);
      expect(report.retention_rate).toBe(50);
      expect(report.churn_rate).toBe(50);
    });

    test("GET /admin/reports/retention endpoint is secure and returns retention report", async () => {
      service.fetchAnalyticsData = jest.fn().mockResolvedValue({
        orders: [{ id: "ord_1", customer_id: "cust_1", total: 1000, created_at: new Date() }],
      });
      await retentionApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Campaign ROI", () => {
    test("calculates ROI based on spend and conversions", async () => {
      service.fetchAnalyticsData = jest.fn().mockResolvedValue({
        orders: [
          { id: "ord_1", campaign_id: "camp_1", total: 10000, created_at: new Date() }, // 10,000 revenue
        ],
      });

      const report = await service.getCampaignRoiReport({});
      expect(report[0].campaign_id).toBe("camp_1");
      expect(report[0].conversions_count).toBe(1);
      expect(report[0].roi).toBe(100); // (10000 - 5000 spend) / 5000 spend = 100%
    });

    test("GET /admin/reports/campaign-roi endpoint returns list", async () => {
      await roiApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Staff Performance", () => {
    test("aggregates delivery stats per driver", async () => {
      const report = await service.getStaffPerformanceReport({});
      expect(report).toHaveLength(1);
      expect(report[0].driver_id).toBe("driver_1");
      expect(report[0].total_deliveries).toBe(1);
      expect(report[0].success_rate).toBe(100);
    });

    test("GET /admin/reports/staff-performance returns metrics", async () => {
      await staffApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Export CSV Engine", () => {
    test("formats arrays into valid CSV strings", () => {
      const headers = ["Name", "Score"];
      const rows = [["Amit", 95], ["Priya", "98"]];
      const csv = service.exportToCsv(headers, rows);
      expect(csv).toBe('"Name","Score"\n"Amit","95"\n"Priya","98"');
    });

    test("GET /admin/reports/export streams CSV", async () => {
      mockReq.query = { type: "retention" };
      service.fetchAnalyticsData = jest.fn().mockResolvedValue({
        orders: [{ id: "ord_1", customer_id: "cust_1", total: 1000, created_at: new Date() }],
      });
      await exportApi(mockReq, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe("Report Schedules CRUD", () => {
    test("creates report schedule configuration", async () => {
      const schedule = await service.createReportSchedule({
        recipient_email: "test@email.com",
        report_type: "sales",
        frequency: "weekly",
      });
      expect(schedule.id).toBeDefined();
      expect(schedule.recipient_email).toBe("test@email.com");
      expect(scheduleStore).toHaveLength(1);
    });

    test("updates report schedule configuration", async () => {
      const schedule = await service.createReportSchedule({
        recipient_email: "test@email.com",
        report_type: "sales",
        frequency: "weekly",
      });
      const updated = await service.updateReportSchedule(schedule.id, {
        frequency: "monthly",
      });
      expect(updated.frequency).toBe("monthly");
    });
  });

  describe("Scheduled Report Job", () => {
    test("sends emails for due report configurations", async () => {
      scheduleStore.push({
        id: "repsch_1",
        recipient_email: "manager@caketohome.com",
        report_type: "sales",
        frequency: "daily",
        last_sent_at: null,
      });

      const mockNotificationService = {
        createNotifications: jest.fn(async (payload) => {
          notificationStore.push(payload);
          return {};
        }),
      };

      const mockContainer = {
        resolve: jest.fn((key: string) => {
          if (key === "analyticsModuleService") return service;
          if (key === "notificationModuleService") return mockNotificationService;
          return null;
        }),
      } as any;

      await sendScheduledReportsJob({ container: mockContainer });

      expect(notificationStore).toHaveLength(1);
      expect(notificationStore[0].to).toBe("manager@caketohome.com");
      expect(scheduleStore[0].last_sent_at).toBeDefined();
    });
  });
});
