import CrmModuleService from "../service";

describe("CRM Module - Automation Engine Unit Tests", () => {
  let service: any;
  let flowStore: any[];
  let executionStore: any[];
  let logStore: any[];
  let templateStore: any[];

  beforeEach(() => {
    flowStore = [];
    executionStore = [];
    logStore = [];
    templateStore = [];

    const dependencies = {
      customerModuleService: {
        retrieveCustomer: jest.fn().mockResolvedValue({
          id: "cust_1",
          first_name: "Amit",
          last_name: "Singh",
        }),
      },
    };

    service = new (CrmModuleService as any)(dependencies, {});

    // Mock AutomationFlow methods
    service.listAutomationFlows = jest.fn(async (selector: any) => {
      return flowStore.filter((f) => {
        return Object.entries(selector || {}).every(([k, v]) => f[k] === v);
      });
    });

    service.retrieveAutomationFlow = jest.fn(async (id: string) => {
      const matched = flowStore.find((f) => f.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });

    service.createAutomationFlows = jest.fn(async (data: any[]) => {
      const created = data.map((f, idx) => ({
        id: `crm_flow_${flowStore.length + idx + 1}`,
        is_active: false,
        ...f,
      }));
      flowStore.push(...created);
      return created;
    });

    service.updateAutomationFlows = jest.fn(async (args: any) => {
      const matched = flowStore.filter((f) => {
        return Object.entries(args.selector).every(([k, v]) => f[k] === v);
      });
      matched.forEach((f) => Object.assign(f, args.data));
      return matched;
    });

    service.deleteAutomationFlows = jest.fn(async (ids: string[]) => {
      flowStore = flowStore.filter((f) => !ids.includes(f.id));
    });

    // Mock AutomationExecution methods
    service.listAutomationExecutions = jest.fn(async (selector: any) => {
      return executionStore.filter((e) => {
        return Object.entries(selector || {}).every(([k, v]) => {
          if (typeof v === "object" && v !== null && "$lte" in v) {
            return new Date(e[k]) <= new Date(v.$lte);
          }
          return e[k] === v;
        });
      });
    });

    service.retrieveAutomationExecution = jest.fn(async (id: string) => {
      const matched = executionStore.find((e) => e.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });

    service.createAutomationExecutions = jest.fn(async (data: any[]) => {
      const created = data.map((e, idx) => ({
        id: `crm_aexec_${executionStore.length + idx + 1}`,
        created_at: new Date(),
        ...e,
      }));
      executionStore.push(...created);
      return created;
    });

    service.updateAutomationExecutions = jest.fn(async (args: any) => {
      const matched = executionStore.filter((e) => {
        return Object.entries(args.selector).every(([k, v]) => e[k] === v);
      });
      matched.forEach((e) => Object.assign(e, args.data));
      return matched;
    });

    // Mock AutomationLog methods
    service.listAutomationLogs = jest.fn(async (selector: any) => {
      return logStore.filter((l) => {
        return Object.entries(selector || {}).every(([k, v]) => l[k] === v);
      });
    });

    service.createAutomationLogs = jest.fn(async (data: any[]) => {
      const created = data.map((l, idx) => ({
        id: `crm_alog_${logStore.length + idx + 1}`,
        ...l,
      }));
      logStore.push(...created);
      return created;
    });

    // Mock Email Template methods for action steps
    service.listEmailTemplates = jest.fn(async () => templateStore);
    service.retrieveEmailTemplate = jest.fn(async (id: string) => {
      const tmpl = templateStore.find((t) => t.id === id);
      if (!tmpl) throw new Error("not found");
      return tmpl;
    });
    service.createEmailTemplates = jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `crm_tmpl_${templateStore.length + idx + 1}`,
        ...t,
      }));
      templateStore.push(...created);
      return created;
    });

    // Mock segmentation helpers used by condition steps
    service.getCustomerStatsForSegmentation = jest.fn().mockResolvedValue({
      order_count: 5,
      total_spent: 100000,
      loyalty_tier: "gold",
    });
  });

  describe("Trigger Automation Flow", () => {
    test("triggers matching active flows and creates execution", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Welcome Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([]),
        is_active: true,
      });

      await service.triggerAutomationFlow("on_signup", "cust_1");

      expect(executionStore).toHaveLength(1);
      expect(executionStore[0].flow_id).toBe("crm_flow_1");
      expect(executionStore[0].customer_id).toBe("cust_1");
      expect(logStore.length).toBeGreaterThanOrEqual(1);
      expect(logStore[0].step_type).toBe("trigger");
    });

    test("does not trigger inactive flows", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Inactive Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([]),
        is_active: false,
      });

      await service.triggerAutomationFlow("on_signup", "cust_1");
      expect(executionStore).toHaveLength(0);
    });

    test("does not trigger flows with different trigger type", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Birthday Flow",
        trigger_type: "on_birthday",
        steps: JSON.stringify([]),
        is_active: true,
      });

      await service.triggerAutomationFlow("on_signup", "cust_1");
      expect(executionStore).toHaveLength(0);
    });
  });

  describe("Execute Automation Steps", () => {
    test("completes execution when flow has no steps", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Empty Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([]),
        is_active: true,
      });

      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "running",
        current_step_id: null,
        metadata: null,
      });

      await service.executeAutomationStep("crm_aexec_1");
      expect(executionStore[0].status).toBe("completed");
    });

    test("executes delay step and sets delayed status", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Delay Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([
          { id: "step_1", type: "delay", config: { duration_seconds: 3600 } },
        ]),
        is_active: true,
      });

      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "running",
        current_step_id: null,
        metadata: null,
      });

      await service.executeAutomationStep("crm_aexec_1");
      expect(executionStore[0].status).toBe("delayed");
      expect(executionStore[0].next_execution_at).toBeDefined();
      expect(logStore.find((l: any) => l.step_type === "delay")).toBeDefined();
    });

    test("executes action step with email dispatch", async () => {
      templateStore.push({
        id: "crm_tmpl_1",
        name: "Welcome",
        subject: "Welcome {{customer_name}}",
        body: "Hello {{customer_name}}",
      });

      flowStore.push({
        id: "crm_flow_1",
        name: "Email Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([
          {
            id: "step_1",
            type: "action",
            config: { channel: "email", template_id: "crm_tmpl_1" },
          },
        ]),
        is_active: true,
      });

      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "running",
        current_step_id: null,
        metadata: null,
      });

      await service.executeAutomationStep("crm_aexec_1");

      const actionLog = logStore.find((l: any) => l.step_type === "action");
      expect(actionLog).toBeDefined();
      expect(actionLog.status).toBe("success");
      expect(actionLog.note).toContain("email template");
    });

    test("marks execution as failed when flow is inactive", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Disabled Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([{ id: "step_1", type: "action", config: {} }]),
        is_active: false,
      });

      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "running",
        current_step_id: null,
        metadata: null,
      });

      await service.executeAutomationStep("crm_aexec_1");
      expect(executionStore[0].status).toBe("failed");
    });
  });

  describe("Delayed Step Runner", () => {
    test("resumes delayed executions past their scheduled time", async () => {
      flowStore.push({
        id: "crm_flow_1",
        name: "Resume Flow",
        trigger_type: "on_signup",
        steps: JSON.stringify([
          { id: "step_1", type: "delay", config: { duration_seconds: 1 } },
        ]),
        is_active: true,
      });

      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "delayed",
        current_step_id: "step_1",
        next_execution_at: new Date(Date.now() - 10000), // 10 seconds ago
        metadata: null,
      });

      await service.runDelayedAutomationSteps();

      // Should have set status back to running then completed
      expect(executionStore[0].status).toBe("completed");
    });

    test("ignores delayed executions not yet due", async () => {
      executionStore.push({
        id: "crm_aexec_1",
        flow_id: "crm_flow_1",
        customer_id: "cust_1",
        status: "delayed",
        current_step_id: "step_1",
        next_execution_at: new Date(Date.now() + 60000), // 1 minute in future
        metadata: null,
      });

      await service.runDelayedAutomationSteps();
      expect(executionStore[0].status).toBe("delayed");
    });
  });
});
