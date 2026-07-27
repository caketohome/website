import CrmModuleService from "../service";
import { TemplateNotFoundError, TemplateValidationError } from "../errors";

describe("CRM Module - Email Templates Unit Tests", () => {
  let service: any;
  let templateStore: any[];

  beforeEach(() => {
    templateStore = [];

    const dependencies = {};
    service = new (CrmModuleService as any)(dependencies, {});

    service.listEmailTemplates = jest.fn(async (selector: any) => {
      return templateStore.filter((t) => {
        return Object.entries(selector || {}).every(([k, v]) => t[k] === v);
      });
    });

    service.retrieveEmailTemplate = jest.fn(async (id: string) => {
      const matched = templateStore.find((t) => t.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });

    service.createEmailTemplates = jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `crm_tmpl_${templateStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        version: 1,
        language_code: "en",
        category: "transactional",
        ...t,
      }));
      templateStore.push(...created);
      return created;
    });

    service.updateEmailTemplates = jest.fn(async (args: any) => {
      const matched = templateStore.filter((t) => {
        return Object.entries(args.selector).every(([k, v]) => t[k] === v);
      });
      matched.forEach((t) => Object.assign(t, args.data, { updated_at: new Date() }));
      return matched;
    });

    service.deleteEmailTemplates = jest.fn(async (ids: string[]) => {
      templateStore = templateStore.filter((t) => !ids.includes(t.id));
    });
  });

  describe("Template CRUD", () => {
    test("creates a template with required fields", async () => {
      const template = await service.createEmailTemplate({
        name: "Welcome Email",
        subject: "Welcome to Cakes2Home, {{customer_name}}!",
        body: "<h1>Hello {{customer_name}}</h1><p>Thank you for signing up.</p>",
      });
      expect(template.id).toBeDefined();
      expect(template.name).toBe("Welcome Email");
      expect(template.is_active).toBe(true);
    });

    test("rejects template without name", async () => {
      await expect(
        service.createEmailTemplate({ subject: "Test", body: "Test body" })
      ).rejects.toThrow(TemplateValidationError);
    });

    test("rejects template without subject", async () => {
      await expect(
        service.createEmailTemplate({ name: "Test", body: "Test body" })
      ).rejects.toThrow(TemplateValidationError);
    });

    test("rejects template without body", async () => {
      await expect(
        service.createEmailTemplate({ name: "Test", subject: "Test" })
      ).rejects.toThrow(TemplateValidationError);
    });

    test("rejects duplicate template names", async () => {
      await service.createEmailTemplate({
        name: "Welcome",
        subject: "Hello",
        body: "Hi there",
      });
      await expect(
        service.createEmailTemplate({
          name: "Welcome",
          subject: "Hello Again",
          body: "Hi again",
        })
      ).rejects.toThrow(TemplateValidationError);
    });

    test("updates a template", async () => {
      const created = await service.createEmailTemplate({
        name: "Original",
        subject: "Original Subject",
        body: "Original body",
      });
      const updated = await service.updateEmailTemplate(created.id, {
        name: "Updated",
        subject: "Updated Subject",
      });
      expect(updated.name).toBe("Updated");
      expect(updated.subject).toBe("Updated Subject");
    });

    test("update rejects empty name", async () => {
      const created = await service.createEmailTemplate({
        name: "Test",
        subject: "Sub",
        body: "Body",
      });
      await expect(
        service.updateEmailTemplate(created.id, { name: "" })
      ).rejects.toThrow(TemplateValidationError);
    });

    test("update throws not found on missing template", async () => {
      await expect(
        service.updateEmailTemplate("crm_tmpl_missing", { name: "Test" })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    test("deletes a template", async () => {
      const created = await service.createEmailTemplate({
        name: "To Delete",
        subject: "Delete Me",
        body: "Remove this",
      });
      expect(templateStore).toHaveLength(1);
      await service.deleteEmailTemplate(created.id);
      expect(templateStore).toHaveLength(0);
    });

    test("delete throws not found on missing template", async () => {
      await expect(
        service.deleteEmailTemplate("crm_tmpl_missing")
      ).rejects.toThrow(TemplateNotFoundError);
    });

    test("retrieves a template by ID", async () => {
      const created = await service.createEmailTemplate({
        name: "Lookup",
        subject: "Find Me",
        body: "Here I am",
      });
      const retrieved = await service.getEmailTemplate(created.id);
      expect(retrieved.name).toBe("Lookup");
    });
  });

  describe("Template Rendering", () => {
    test("renders template with variable substitution", async () => {
      await service.createEmailTemplate({
        name: "Order Confirm",
        subject: "Order {{order_id}} confirmed",
        body: "<p>Hello {{customer_name}}, your order {{order_id}} is confirmed.</p>",
      });
      const template = templateStore[0];
      const rendered = await service.renderTemplate(template.id, {
        order_id: "ORD-123",
        customer_name: "Amit",
      });
      expect(rendered.subject).toBe("Order ORD-123 confirmed");
      expect(rendered.body).toContain("Hello Amit");
      expect(rendered.body).toContain("order ORD-123");
    });

    test("preserves unresolved variables", async () => {
      await service.createEmailTemplate({
        name: "Partial",
        subject: "Hello {{name}}",
        body: "Your code is {{code}}",
      });
      const template = templateStore[0];
      const rendered = await service.renderTemplate(template.id, { name: "Priya" });
      expect(rendered.subject).toBe("Hello Priya");
      expect(rendered.body).toBe("Your code is {{code}}");
    });
  });
});
