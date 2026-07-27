import AnalyticsModuleService from "../service";
import { GET as getDashboardApi } from "../../../api/admin/analytics/dashboard/route";
import { GET as getMetricsApi } from "../../../api/admin/analytics/metrics/route";
import { AnalyticsValidationError, BranchNotFoundError, FranchiseNotFoundError } from "../errors";

describe("Analytics Module - Financial & Operational Analytics Foundation Tests", () => {
  let service: any;
  let mockQuery: any;
  let mockShopModule: any;
  let expenseStore: any[];
  let franchiseStore: any[];

  beforeEach(() => {
    expenseStore = [
      { id: "exp_1", branch_id: "res_1", name: "Rent", category: "rent", amount: 100000, expense_date: new Date("2026-07-10") },
      { id: "exp_2", branch_id: "res_2", name: "Utilities", category: "utilities", amount: 50000, expense_date: new Date("2026-07-12") },
      { id: "exp_3", branch_id: "res_1", name: "Flour", category: "ingredients", amount: 20000, expense_date: new Date("2026-07-15") },
    ];

    franchiseStore = [
      { id: "fran_1", shop_id: "res_1", franchisee_name: "Partner A", commission_rate: 10.0, is_active: true },
      { id: "fran_2", shop_id: "res_2", franchisee_name: "Partner B", commission_rate: 5.0, is_active: true },
    ];

    mockQuery = {
      graph: jest.fn(async ({ entity }: any) => {
        if (entity === "shop") {
          return {
            data: [
              {
                id: "res_1",
                name: "Delhi Branch",
                deliveries: [
                  {
                    id: "del_1",
                    order: { id: "ord_1", total: 100000, status: "completed", created_at: new Date("2026-07-11") },
                  },
                  {
                    id: "del_2",
                    order: { id: "ord_2", total: 150000, status: "completed", created_at: new Date("2026-07-13") },
                  },
                  {
                    id: "del_3",
                    order: { id: "ord_5", total: 50000, status: "canceled", created_at: new Date("2026-07-14") }, // should be ignored
                  },
                ],
              },
              {
                id: "res_2",
                name: "Noida Branch",
                deliveries: [
                  {
                    id: "del_4",
                    order: { id: "ord_3", total: 80000, status: "completed", created_at: new Date("2026-07-12") },
                  },
                ],
              },
            ],
          };
        }
        return { data: [] };
      }),
    };

    mockShopModule = {
      retrieveShop: jest.fn(async (id: string) => {
        if (id === "res_1" || id === "res_2") return { id, name: "Shop" };
        throw new Error("not found");
      }),
      retrieveBranch: jest.fn(async (id: string) => {
        throw new Error("not found");
      }),
    };

    const dependencies = {
      query: mockQuery,
      shopModuleService: mockShopModule,
    };

    service = new (AnalyticsModuleService as any)(dependencies, {});

    // Stub service models methods
    service.listExpenses = jest.fn(async () => expenseStore);
    service.listFranchises = jest.fn(async () => franchiseStore);
    service.retrieveFranchise = jest.fn(async (id: string) => {
      const found = franchiseStore.find((f) => f.id === id);
      if (!found) throw new Error("not found");
      return found;
    });
  });

  describe("Service Aggregation & Metric Calculation Logic", () => {
    it("calculates total revenue correctly, ignoring canceled orders", async () => {
      const revenue = await service.totalRevenue();
      // ord_1 (100000) + ord_2 (150000) + ord_3 (80000) = 330000
      expect(revenue).toBe(330000);
    });

    it("filters total revenue by date range", async () => {
      const revenue = await service.totalRevenue({
        from: new Date("2026-07-10"),
        to: new Date("2026-07-12"),
      });
      // ord_1 (2026-07-11: 100000) + ord_3 (2026-07-12: 80000) = 180000
      expect(revenue).toBe(180000);
    });

    it("filters total revenue by branch_id", async () => {
      const revenue = await service.totalRevenue({ branch_id: "res_2" });
      // ord_3 (80000) = 80000
      expect(revenue).toBe(80000);
    });

    it("calculates total expenses correctly", async () => {
      const expenses = await service.totalExpenses();
      // exp_1 (100000) + exp_2 (50000) + exp_3 (20000) = 170000
      expect(expenses).toBe(170000);
    });

    it("calculates net profit correctly", async () => {
      const net = await service.netProfit();
      // 330000 - 170000 = 160000
      expect(net).toBe(160000);
    });

    it("calculates branch breakdowns correctly", async () => {
      const summaries = await service.branchRevenue();
      expect(summaries).toHaveLength(2);

      const delhi = summaries.find((s) => s.branch_id === "res_1");
      expect(delhi.revenue).toBe(250000);
      expect(delhi.expenses).toBe(120000); // 100000 + 20000
      expect(delhi.net_profit).toBe(130000);
    });

    it("calculates franchise commissions correctly", async () => {
      const franchises = await service.franchiseRevenue();
      expect(franchises).toHaveLength(2);

      const fran1 = franchises.find((f) => f.franchise_id === "fran_1");
      expect(fran1.order_revenue).toBe(250000);
      expect(fran1.commission).toBe(25000); // 10% of 250000
    });

    it("calculates daily trends correctly", async () => {
      const trends = await service.revenueTrend({ interval: "daily" });
      // 2026-07-11: 100000, 2026-07-12: 80000, 2026-07-13: 150000
      expect(trends).toHaveLength(3);
      expect(trends[0].date).toBe("2026-07-11");
      expect(trends[0].value).toBe(100000);
    });

    it("throws validation error on invalid date ranges", async () => {
      await expect(service.totalRevenue({
        from: new Date("2026-07-20"),
        to: new Date("2026-07-10"),
      })).rejects.toThrow(AnalyticsValidationError);
    });

    it("throws branch not found error on missing branch ID", async () => {
      await expect(service.totalRevenue({ branch_id: "res_missing" })).rejects.toThrow(BranchNotFoundError);
    });

    it("throws franchise not found error on missing franchise ID", async () => {
      await expect(service.totalRevenue({ franchise_id: "fran_missing" })).rejects.toThrow(FranchiseNotFoundError);
    });

    it("computes new metrics (aov, revenue, expenses, net_profit) correctly via computeMetric", async () => {
      const aovResult = await service.computeMetric("aov");
      // Total Revenue = 330000. Total Orders count = 3. AOV = 110000
      expect(aovResult.metric).toBe("aov");
      expect(aovResult.value).toBe(110000);

      const revenueResult = await service.computeMetric("revenue");
      expect(revenueResult.metric).toBe("revenue");
      expect(revenueResult.value).toBe(330000);

      const expensesResult = await service.computeMetric("expenses");
      expect(expensesResult.metric).toBe("expenses");
      expect(expensesResult.value).toBe(170000);

      const netProfitResult = await service.computeMetric("net_profit");
      expect(netProfitResult.metric).toBe("net_profit");
      expect(netProfitResult.value).toBe(160000);
    });

    it("throws error for unsupported metric in computeMetric", async () => {
      await expect(service.computeMetric("unsupported_metric"))
        .rejects.toThrow(AnalyticsValidationError);
    });
  });

  describe("API Handler Unit Tests", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        query: { interval: "daily" },
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
      };
    });

    it("returns 401 if unauthorized", async () => {
      delete mockReq.auth_context;
      await getDashboardApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("returns 200 with dashboard summary payloads", async () => {
      await getDashboardApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          revenue: 330000,
          expenses: 170000,
          net_profit: 160000,
          sales_trends: expect.any(Array),
          expense_trends: expect.any(Array),
          branch_summaries: expect.any(Array),
          franchise_summaries: expect.any(Array),
        })
      );
    });

    it("returns 400 on invalid date ranges in API", async () => {
      mockReq.query.from = "invalid-date";
      await getDashboardApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("Metrics API Handler Unit Tests", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        query: { metric: "visitors" },
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
      };
    });

    it("returns 401 if unauthorized in metrics API", async () => {
      delete mockReq.auth_context;
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("returns 400 if metric query parameter is missing", async () => {
      delete mockReq.query.metric;
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ANALYTICS_VALIDATION_FAILED",
        })
      );
    });

    it("returns 400 on invalid date format in metrics API", async () => {
      mockReq.query.from = "invalid-date";
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ANALYTICS_VALIDATION_FAILED",
        })
      );
    });

    it("returns 400 on invalid date range in metrics API", async () => {
      mockReq.query.from = "2026-07-20";
      mockReq.query.to = "2026-07-10";
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ANALYTICS_VALIDATION_FAILED",
        })
      );
    });

    it("returns 400 on unsupported metric in metrics API", async () => {
      mockReq.query.metric = "unsupported_metric";
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ANALYTICS_VALIDATION_FAILED",
        })
      );
    });

    it("returns 200 with successful metric response", async () => {
      mockReq.query.metric = "aov";
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        result: expect.objectContaining({
          metric: "aov",
          value: 110000,
        }),
      });
    });

    it("maps BranchNotFoundError to 404 in metrics API", async () => {
      mockReq.query.metric = "aov";
      mockReq.query.branch_id = "res_missing";
      await getMetricsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "BRANCH_NOT_FOUND",
        })
      );
    });
  });
});
