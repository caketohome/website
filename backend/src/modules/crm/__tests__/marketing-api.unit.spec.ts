import CrmModuleService from "../service";
import { GET as listTemplatesApi, POST as createTemplateApi } from "../../../api/admin/crm/templates/route";
import { GET as getTemplateApi, POST as updateTemplateApi, DELETE as deleteTemplateApi } from "../../../api/admin/crm/templates/[id]/route";
import { POST as testSendApi } from "../../../api/admin/crm/templates/[id]/test-send/route";
import { GET as listAutomationApi, POST as createAutomationApi } from "../../../api/admin/crm/automation/route";
import { GET as getAutomationApi, POST as updateAutomationApi, DELETE as deleteAutomationApi } from "../../../api/admin/crm/automation/[id]/route";
import { POST as triggerAutomationApi } from "../../../api/admin/crm/automation/[id]/trigger/route";
import { GET as listExecutionsApi } from "../../../api/admin/crm/automation/executions/route";
import { GET as listABTestsApi, POST as createABTestApi } from "../../../api/admin/crm/ab-tests/route";
import { GET as getABTestApi, POST as updateABTestApi, DELETE as deleteABTestApi } from "../../../api/admin/crm/ab-tests/[id]/route";
import { GET as getAnalyticsApi } from "../../../api/admin/crm/analytics/route";
import { TemplateNotFoundError, TemplateValidationError, ABTestNotFoundError, ABTestValidationError } from "../errors";

describe("CRM Module - Marketing API Hardening Unit Tests", () => {
  let service: any;
  let templateStore: any[];
  let flowStore: any[];
  let executionStore: any[];
  let abTestStore: any[];
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    templateStore = [];
    flowStore = [];
    executionStore = [];
    abTestStore = [];

    const dependencies = {
      orderModuleService: {
        listOrders: jest.fn().mockResolvedValue([]),
      },
    };

    service = new (CrmModuleService as any)(dependencies, {});

    // Mock template methods
    service.listEmailTemplates = jest.fn(async (sel: any) => templateStore.filter((t) => Object.entries(sel || {}).every(([k, v]) => t[k] === v)));
    service.retrieveEmailTemplate = jest.fn(async (id: string) => { const m = templateStore.find((t) => t.id === id); if (!m) throw new TemplateNotFoundError(id); return m; });
    service.createEmailTemplates = jest.fn(async (arr: any[]) => { const c = arr.map((t, i) => ({ id: `crm_tmpl_${i + 1}`, is_active: true, version: 1, ...t })); templateStore.push(...c); return c; });
    service.updateEmailTemplates = jest.fn(async (args: any) => { const m = templateStore.filter((t) => Object.entries(args.selector).every(([k, v]) => t[k] === v)); m.forEach((t) => Object.assign(t, args.data)); return m; });
    service.deleteEmailTemplates = jest.fn(async (ids: string[]) => { templateStore = templateStore.filter((t) => !ids.includes(t.id)); });

    // Mock automation methods
    service.listAutomationFlows = jest.fn(async (sel: any) => flowStore.filter((f) => Object.entries(sel || {}).every(([k, v]) => f[k] === v)));
    service.retrieveAutomationFlow = jest.fn(async (id: string) => { const m = flowStore.find((f) => f.id === id); if (!m) throw new Error("not found"); return m; });
    service.createAutomationFlows = jest.fn(async (arr: any[]) => { const c = arr.map((f, i) => ({ id: `crm_flow_${i + 1}`, is_active: false, ...f })); flowStore.push(...c); return c; });
    service.updateAutomationFlows = jest.fn(async (args: any) => { const m = flowStore.filter((f) => Object.entries(args.selector).every(([k, v]) => f[k] === v)); m.forEach((f) => Object.assign(f, args.data)); return m; });
    service.deleteAutomationFlows = jest.fn(async (ids: string[]) => { flowStore = flowStore.filter((f) => !ids.includes(f.id)); });

    // Mock execution methods
    service.listAutomationExecutions = jest.fn(async (sel: any) => executionStore);
    service.triggerAutomationFlow = jest.fn().mockResolvedValue(undefined);
    service.runDelayedAutomationSteps = jest.fn().mockResolvedValue(undefined);

    // Mock A/B test methods
    service.listABTests = jest.fn(async (sel: any) => abTestStore);
    service.retrieveABTest = jest.fn(async (id: string) => { const m = abTestStore.find((t) => t.id === id); if (!m) throw new ABTestNotFoundError(id); return m; });
    service.createABTests = jest.fn(async (arr: any[]) => { const c = arr.map((t, i) => ({ id: `crm_ab_${i + 1}`, ...t })); abTestStore.push(...c); return c; });
    service.updateABTests = jest.fn(async (args: any) => { const m = abTestStore.filter((t) => Object.entries(args.selector).every(([k, v]) => t[k] === v)); m.forEach((t) => Object.assign(t, args.data)); return m; });
    service.deleteABTests = jest.fn(async (ids: string[]) => { abTestStore = abTestStore.filter((t) => !ids.includes(t.id)); });

    // Mock analytics
    service.getMarketingDashboardAnalytics = jest.fn().mockResolvedValue({
      revenue_lift: 50000,
      conversion_rate: 25,
      repeat_purchase_rate: 40,
      funnel: { active_audiences: 10, completed_conversions: 3 },
      ab_tests_count: 2,
    });

    mockReq = {
      params: { id: "crm_tmpl_1" },
      body: { name: "Test", subject: "Sub", body: "Body" },
      filterableFields: {},
      listConfig: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "crmModuleService") return service;
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

  describe("Authentication Gates", () => {
    test("all template endpoints return 401 without auth", async () => {
      delete mockReq.auth_context;

      await listTemplatesApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await testSendApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test("all automation endpoints return 401 without auth", async () => {
      delete mockReq.auth_context;

      await listAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await triggerAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await listExecutionsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test("all ab-tests endpoints return 401 without auth", async () => {
      delete mockReq.auth_context;

      await listABTestsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test("analytics endpoint returns 401 without auth", async () => {
      delete mockReq.auth_context;
      await getAnalyticsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Template API Happy Paths", () => {
    test("GET /templates returns list", async () => {
      templateStore.push({ id: "crm_tmpl_1", name: "T1", subject: "S", body: "B" });
      await listTemplatesApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ templates: expect.any(Array) }));
    });

    test("POST /templates creates template", async () => {
      await createTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test("POST /templates returns 400 on validation error", async () => {
      delete mockReq.body.name;
      await createTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test("DELETE /templates/:id removes template", async () => {
      templateStore.push({ id: "crm_tmpl_1", name: "T1", subject: "S", body: "B" });
      await deleteTemplateApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(templateStore).toHaveLength(0);
    });

    test("POST /templates/:id/test-send renders template", async () => {
      templateStore.push({ id: "crm_tmpl_1", name: "T1", subject: "Hi {{name}}", body: "Hello {{name}}" });
      mockReq.body = { variables: { name: "Test" } };
      await testSendApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        rendered: expect.objectContaining({ subject: "Hi Test" }),
      }));
    });
  });

  describe("Automation API Happy Paths", () => {
    test("GET /automation returns flows list", async () => {
      flowStore.push({ id: "crm_flow_1", name: "Flow", trigger_type: "on_signup", steps: "[]", is_active: true });
      await listAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test("POST /automation creates flow", async () => {
      mockReq.body = { name: "New Flow", trigger_type: "on_signup", steps: [] };
      await createAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test("POST /automation returns 400 on missing name", async () => {
      mockReq.body = { trigger_type: "on_signup" };
      await createAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test("POST /automation/:id/trigger requires customer_id", async () => {
      flowStore.push({ id: "crm_flow_1", name: "Flow", trigger_type: "on_signup", steps: "[]", is_active: true });
      mockReq.params.id = "crm_flow_1";
      mockReq.body = {};
      await triggerAutomationApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test("GET /automation/executions returns list", async () => {
      await listExecutionsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("A/B Test API Happy Paths", () => {
    test("GET /ab-tests returns list", async () => {
      await listABTestsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test("POST /ab-tests creates test", async () => {
      mockReq.body = {
        name: "Test",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "a",
        variant_b_id: "b",
      };
      await createABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test("DELETE /ab-tests/:id returns 404 on missing test", async () => {
      mockReq.params.id = "crm_ab_missing";
      await deleteABTestApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe("Analytics API", () => {
    test("GET /analytics returns dashboard data", async () => {
      await getAnalyticsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        analytics: expect.objectContaining({
          revenue_lift: expect.any(Number),
          conversion_rate: expect.any(Number),
        }),
      }));
    });
  });
});
