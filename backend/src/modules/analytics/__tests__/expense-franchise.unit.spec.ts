import AnalyticsModuleService from "../service";
import { GET as listExpensesApi, POST as createExpenseApi } from "../../../api/admin/analytics/expenses/route";
import { GET as getExpenseApi, PATCH as updateExpenseApi, DELETE as deleteExpenseApi } from "../../../api/admin/analytics/expenses/[id]/route";
import { GET as listFranchisesApi, POST as createFranchiseApi } from "../../../api/admin/analytics/franchises/route";
import { GET as getFranchiseApi, PATCH as updateFranchiseApi, DELETE as deleteFranchiseApi } from "../../../api/admin/analytics/franchises/[id]/route";
import { ExpenseNotFoundError, ExpenseValidationError, FranchiseNotFoundError, FranchiseValidationError } from "../errors";

describe("Analytics Module - Expense & Franchise Unit Tests", () => {
  let service: any;
  let expenseStore: any[];
  let franchiseStore: any[];

  beforeEach(() => {
    expenseStore = [];
    franchiseStore = [];

    const dependencies = {};
    service = new (AnalyticsModuleService as any)(dependencies, {});

    // Mock MedusaService generated methods for Expense
    service.listExpenses = jest.fn(async (selector: any) => {
      return expenseStore.filter((x) => {
        return Object.entries(selector).every(([k, v]) => x[k] === v);
      });
    });
    service.retrieveExpense = jest.fn(async (id: string) => {
      const matched = expenseStore.find((x) => x.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });
    service.createExpenses = jest.fn(async (data: any[]) => {
      const created = data.map((x, idx) => ({
        id: `exp_${expenseStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        ...x,
      }));
      expenseStore.push(...created);
      return created;
    });
    service.updateExpenses = jest.fn(async (args: any) => {
      const matched = expenseStore.filter((x) => {
        return Object.entries(args.selector).every(([k, v]) => x[k] === v);
      });
      matched.forEach((x) => Object.assign(x, args.data, { updated_at: new Date() }));
      return matched;
    });
    service.deleteExpenses = jest.fn(async (ids: string[]) => {
      expenseStore = expenseStore.filter((x) => !ids.includes(x.id));
    });

    // Mock MedusaService generated methods for Franchise
    service.listFranchises = jest.fn(async (selector: any) => {
      return franchiseStore.filter((x) => {
        return Object.entries(selector).every(([k, v]) => x[k] === v);
      });
    });
    service.retrieveFranchise = jest.fn(async (id: string) => {
      const matched = franchiseStore.find((x) => x.id === id);
      if (!matched) throw new Error("not found");
      return matched;
    });
    service.createFranchises = jest.fn(async (data: any[]) => {
      const created = data.map((x, idx) => ({
        id: `fran_${franchiseStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        ...x,
      }));
      franchiseStore.push(...created);
      return created;
    });
    service.updateFranchises = jest.fn(async (args: any) => {
      const matched = franchiseStore.filter((x) => {
        return Object.entries(args.selector).every(([k, v]) => x[k] === v);
      });
      matched.forEach((x) => Object.assign(x, args.data, { updated_at: new Date() }));
      return matched;
    });
    service.deleteFranchises = jest.fn(async (ids: string[]) => {
      franchiseStore = franchiseStore.filter((x) => !ids.includes(x.id));
    });
  });

  describe("Expense Operations", () => {
    it("creates an expense successfully", async () => {
      const expense = await service.createExpense({
        name: "Branch Rent",
        amount: 5000000,
        category: "rent",
        expense_date: new Date(),
      });

      expect(expense.id).toBeDefined();
      expect(expense.name).toBe("Branch Rent");
      expect(expenseStore).toHaveLength(1);
    });

    it("throws error on missing fields or negative amount", async () => {
      await expect(service.createExpense({
        name: "",
        amount: 5000000,
        category: "rent",
        expense_date: new Date(),
      })).rejects.toThrow(ExpenseValidationError);

      await expect(service.createExpense({
        name: "Rent",
        amount: -100,
        category: "rent",
        expense_date: new Date(),
      })).rejects.toThrow(ExpenseValidationError);

      await expect(service.createExpense({
        name: "Rent",
        amount: 5000000,
        category: "invalid_cat",
        expense_date: new Date(),
      })).rejects.toThrow(ExpenseValidationError);
    });

    it("updates expense successfully", async () => {
      const created = await service.createExpense({
        name: "Electricity Bill",
        amount: 1500000,
        category: "utilities",
        expense_date: new Date(),
      });

      const updated = await service.updateExpense(created.id, { amount: 1800000 });
      expect(updated.amount).toBe(1800000);
    });

    it("deletes expense successfully", async () => {
      const created = await service.createExpense({
        name: "Salaries",
        amount: 8000000,
        category: "salaries",
        expense_date: new Date(),
      });

      expect(expenseStore).toHaveLength(1);
      await service.deleteExpense(created.id);
      expect(expenseStore).toHaveLength(0);
    });

    it("throws error deleting missing expense", async () => {
      await expect(service.deleteExpense("exp_missing")).rejects.toThrow(ExpenseNotFoundError);
    });
  });

  describe("Franchise Operations", () => {
    it("creates a franchise successfully", async () => {
      const franchise = await service.createFranchise({
        franchisee_name: "John Doe",
        shop_id: "shop_branch_1",
        commission_rate: 5.5,
      });

      expect(franchise.id).toBeDefined();
      expect(franchise.franchisee_name).toBe("John Doe");
      expect(franchiseStore).toHaveLength(1);
    });

    it("throws error on missing fields or invalid commission rate", async () => {
      await expect(service.createFranchise({
        franchisee_name: "",
        shop_id: "shop_1",
        commission_rate: 5,
      })).rejects.toThrow(FranchiseValidationError);

      await expect(service.createFranchise({
        franchisee_name: "John",
        shop_id: "shop_1",
        commission_rate: 105,
      })).rejects.toThrow(FranchiseValidationError);
    });

    it("enforces unique branch/shop franchise agreement link", async () => {
      await service.createFranchise({
        franchisee_name: "Partner A",
        shop_id: "branch_dup",
        commission_rate: 6.0,
      });

      await expect(service.createFranchise({
        franchisee_name: "Partner B",
        shop_id: "branch_dup",
        commission_rate: 7.0,
      })).rejects.toThrow(FranchiseValidationError);
    });

    it("updates franchise details successfully", async () => {
      const created = await service.createFranchise({
        franchisee_name: "Partner A",
        shop_id: "shop_1",
        commission_rate: 4.5,
      });

      const updated = await service.updateFranchise(created.id, { commission_rate: 5.0 });
      expect(updated.commission_rate).toBe(5.0);
    });

    it("deletes franchise successfully", async () => {
      const created = await service.createFranchise({
        franchisee_name: "Partner A",
        shop_id: "shop_1",
        commission_rate: 4.5,
      });

      expect(franchiseStore).toHaveLength(1);
      await service.deleteFranchise(created.id);
      expect(franchiseStore).toHaveLength(0);
    });
  });

  describe("API Endpoint Handlers", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        params: { id: "exp_1" },
        body: { name: "Audit Fee", amount: 100000, category: "miscellaneous", expense_date: new Date() },
        filterableFields: {},
        listConfig: {},
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

      await listExpensesApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await listFranchisesApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("POST /expenses resolves status 201", async () => {
      await createExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("PATCH /expenses/:id updates successfully", async () => {
      const created = await service.createExpense({
        name: "Internet Bill",
        amount: 200000,
        category: "utilities",
        expense_date: new Date(),
      });
      mockReq.params.id = created.id;
      mockReq.body = { amount: 250000 };

      await updateExpenseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("POST /franchises enforces shop uniqueness and returns 400", async () => {
      await service.createFranchise({
        franchisee_name: "Partner A",
        shop_id: "branch_dup",
        commission_rate: 6.0,
      });

      mockReq.body = {
        franchisee_name: "Partner B",
        shop_id: "branch_dup",
        commission_rate: 7.0,
      };

      await createFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("DELETE /franchises/:id removes agreement successfully", async () => {
      const created = await service.createFranchise({
        franchisee_name: "Partner A",
        shop_id: "shop_1",
        commission_rate: 4.5,
      });
      mockReq.params.id = created.id;

      await deleteFranchiseApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(franchiseStore).toHaveLength(0);
    });
  });
});
