import CrmModuleService from "../service";
import { ABTestNotFoundError, ABTestValidationError } from "../errors";

describe("CRM Module - A/B Testing Unit Tests", () => {
  let service: any;
  let abTestStore: any[];

  beforeEach(() => {
    abTestStore = [];

    const dependencies = {};
    service = new (CrmModuleService as any)(dependencies, {});

    service.listABTests = jest.fn(async (selector: any) => {
      return abTestStore.filter((t) => {
        return Object.entries(selector || {}).every(([k, v]) => t[k] === v);
      });
    });

    service.retrieveABTest = jest.fn(async (id: string) => {
      const matched = abTestStore.find((t) => t.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });

    service.createABTests = jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `crm_ab_${abTestStore.length + idx + 1}`,
        ratio_a: 50,
        ratio_b: 50,
        confidence_score: 0,
        winner: null,
        created_at: new Date(),
        ...t,
      }));
      abTestStore.push(...created);
      return created;
    });

    service.updateABTests = jest.fn(async (args: any) => {
      const matched = abTestStore.filter((t) => {
        return Object.entries(args.selector).every(([k, v]) => t[k] === v);
      });
      matched.forEach((t) => Object.assign(t, args.data));
      return matched;
    });

    service.deleteABTests = jest.fn(async (ids: string[]) => {
      abTestStore = abTestStore.filter((t) => !ids.includes(t.id));
    });
  });

  describe("A/B Test CRUD", () => {
    test("creates an A/B test with required fields", async () => {
      const test = await service.createABTest({
        name: "Homepage Banner Test",
        test_type: "campaign",
        target_id: "mkt_camp_1",
        variant_a_id: "banner_red",
        variant_b_id: "banner_blue",
      });
      expect(test.id).toBeDefined();
      expect(test.name).toBe("Homepage Banner Test");
      expect(test.status).toBe("draft");
    });

    test("rejects test without name", async () => {
      await expect(
        service.createABTest({
          test_type: "campaign",
          target_id: "camp_1",
          variant_a_id: "a",
          variant_b_id: "b",
        })
      ).rejects.toThrow(ABTestValidationError);
    });

    test("rejects test without test_type", async () => {
      await expect(
        service.createABTest({
          name: "Test",
          target_id: "camp_1",
          variant_a_id: "a",
          variant_b_id: "b",
        })
      ).rejects.toThrow(ABTestValidationError);
    });

    test("rejects test without variants", async () => {
      await expect(
        service.createABTest({
          name: "Test",
          test_type: "campaign",
          target_id: "camp_1",
        })
      ).rejects.toThrow(ABTestValidationError);
    });

    test("updates an A/B test", async () => {
      const created = await service.createABTest({
        name: "Original",
        test_type: "email",
        target_id: "tmpl_1",
        variant_a_id: "a",
        variant_b_id: "b",
      });
      const updated = await service.updateABTest(created.id, { status: "active" });
      expect(updated.status).toBe("active");
    });

    test("update throws not found on missing test", async () => {
      await expect(
        service.updateABTest("crm_ab_missing", { status: "active" })
      ).rejects.toThrow(ABTestNotFoundError);
    });

    test("retrieves test with parsed metrics", async () => {
      const created = await service.createABTest({
        name: "Metrics Test",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "a",
        variant_b_id: "b",
      });
      const retrieved = await service.getABTest(created.id);
      expect(retrieved.metrics_a).toEqual({ impressions: 0, conversions: 0 });
      expect(retrieved.metrics_b).toEqual({ impressions: 0, conversions: 0 });
    });
  });

  describe("Variant Selection", () => {
    test("selects variant deterministically for a customer", async () => {
      abTestStore.push({
        id: "crm_ab_1",
        name: "Test",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "red",
        variant_b_id: "blue",
        ratio_a: 50,
        ratio_b: 50,
        metrics_a: JSON.stringify({ impressions: 0, conversions: 0 }),
        metrics_b: JSON.stringify({ impressions: 0, conversions: 0 }),
        status: "active",
        winner: null,
        confidence_score: 0,
      });

      const variant1 = await service.selectVariantForCustomer("crm_ab_1", "cust_1");
      const variant2 = await service.selectVariantForCustomer("crm_ab_1", "cust_1");
      // Same customer should get same variant (deterministic)
      expect(variant1).toBe(variant2);
    });

    test("increments impression counts on variant selection", async () => {
      abTestStore.push({
        id: "crm_ab_1",
        name: "Test",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "red",
        variant_b_id: "blue",
        ratio_a: 50,
        ratio_b: 50,
        metrics_a: JSON.stringify({ impressions: 0, conversions: 0 }),
        metrics_b: JSON.stringify({ impressions: 0, conversions: 0 }),
        status: "active",
        winner: null,
        confidence_score: 0,
      });

      await service.selectVariantForCustomer("crm_ab_1", "cust_1");
      const mA = JSON.parse(abTestStore[0].metrics_a);
      const mB = JSON.parse(abTestStore[0].metrics_b);
      expect(mA.impressions + mB.impressions).toBe(1);
    });
  });

  describe("Conversion Recording", () => {
    test("records conversion and updates metrics", async () => {
      abTestStore.push({
        id: "crm_ab_1",
        name: "Test",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "red",
        variant_b_id: "blue",
        ratio_a: 50,
        ratio_b: 50,
        metrics_a: JSON.stringify({ impressions: 100, conversions: 5 }),
        metrics_b: JSON.stringify({ impressions: 100, conversions: 3 }),
        status: "active",
        winner: null,
        confidence_score: 0,
      });

      await service.recordVariantConversion("crm_ab_1", "cust_1");
      const mA = JSON.parse(abTestStore[0].metrics_a);
      const mB = JSON.parse(abTestStore[0].metrics_b);
      expect(mA.conversions + mB.conversions).toBe(9); // 5+3+1
    });

    test("does not record conversion for non-active test", async () => {
      abTestStore.push({
        id: "crm_ab_1",
        name: "Done",
        test_type: "campaign",
        target_id: "camp_1",
        variant_a_id: "red",
        variant_b_id: "blue",
        ratio_a: 50,
        ratio_b: 50,
        metrics_a: JSON.stringify({ impressions: 100, conversions: 50 }),
        metrics_b: JSON.stringify({ impressions: 100, conversions: 50 }),
        status: "completed",
        winner: "variant_a",
        confidence_score: 99,
      });

      await service.recordVariantConversion("crm_ab_1", "cust_1");
      // Metrics should remain unchanged
      const mA = JSON.parse(abTestStore[0].metrics_a);
      expect(mA.conversions).toBe(50);
    });
  });

  describe("Winner Calculation", () => {
    test("calculates no winner when insufficient data", () => {
      const result = (service as any).calculateWinner(
        { impressions: 10, conversions: 1 },
        { impressions: 10, conversions: 1 }
      );
      expect(result.winner).toBeNull();
    });

    test("calculates winner with high confidence", () => {
      const result = (service as any).calculateWinner(
        { impressions: 1000, conversions: 150 },
        { impressions: 1000, conversions: 50 }
      );
      expect(result.confidence).toBeGreaterThanOrEqual(95);
      expect(result.winner).toBe("variant_a");
    });

    test("handles zero impressions gracefully", () => {
      const result = (service as any).calculateWinner(
        { impressions: 0, conversions: 0 },
        { impressions: 0, conversions: 0 }
      );
      expect(result.winner).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });
});
