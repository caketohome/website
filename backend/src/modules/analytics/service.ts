import { MedusaService } from "@medusajs/utils";
import { EventEmitter } from "events";
import { AnalyticsEvent, Expense, Franchise, ReportSchedule } from "./models";
import type { CreateAnalyticsEventDTO, MetricResult } from "./types/common";
import { ExpenseNotFoundError, ExpenseValidationError, FranchiseNotFoundError, FranchiseValidationError, AnalyticsValidationError, BranchNotFoundError } from "./errors";

/**
 * Analytics module service.
 * Ingests structured events and computes aggregate metrics for dashboards/reports.
 */
class AnalyticsModuleService extends MedusaService({
    AnalyticsEvent,
    Expense,
    Franchise,
    ReportSchedule,
}) {
    protected container: any;
    public static emitter = new EventEmitter();

    constructor(dependencies: any, ...args: any[]) {
        super(dependencies, ...args);
        this.container = dependencies;
    }
    /**
     * Track a single analytics event.
     */
    async track(input: CreateAnalyticsEventDTO): Promise<void> {
        const created = await this.createAnalyticsEvents({
            event_type: input.event_type,
            entity_id: input.entity_id ?? null,
            customer_id: input.customer_id ?? null,
            session_id: input.session_id ?? null,
            branch_id: input.branch_id ?? null,
            payload: input.payload ? JSON.stringify(input.payload) : null,
        });

        AnalyticsModuleService.emitter.emit("event", {
            ...input,
            created_at: new Date(),
        });
    }

    /**
     * Count events of a type within an optional date range and branch.
     */
    async countEvents(
        eventType: string,
        options?: { from?: Date; to?: Date; branch_id?: string }
    ): Promise<number> {
        const filters: Record<string, unknown> = { event_type: eventType };
        if (options?.branch_id) filters.branch_id = options.branch_id;

        const events = await this.listAnalyticsEvents(filters);
        const from = options?.from?.getTime() ?? 0;
        const to = options?.to?.getTime() ?? Date.now();

        return events.filter((e: Record<string, unknown>) => {
            const createdAt = (e.created_at as Date).getTime();
            return createdAt >= from && createdAt <= to;
        }).length;
    }

    /**
     * Compute a named metric over a period.
     * Supported metrics: visitors, add_to_cart, checkout_started, purchase,
     * conversion_rate, returning_customers.
     */
    async computeMetric(
        metric: string,
        options?: { from?: Date; to?: Date; branch_id?: string }
    ): Promise<MetricResult> {
        const validMetrics = [
            "visitors",
            "add_to_cart",
            "checkout_started",
            "purchase",
            "conversion_rate",
            "returning_customers",
            "aov",
            "revenue",
            "expenses",
            "net_profit"
        ];

        if (!validMetrics.includes(metric)) {
            throw new AnalyticsValidationError(`Unsupported metric: ${metric}`);
        }

        await this.validateOptions(options);

        const period = `${options?.from?.toISOString() ?? "begin"}_${options?.to?.toISOString() ?? "now"}`;

        switch (metric) {
            case "visitors":
            case "add_to_cart":
            case "checkout_started":
            case "purchase": {
                const value = await this.countEvents(metric, options);
                return { metric, value, period, branch_id: options?.branch_id };
            }
            case "conversion_rate": {
                const purchases = await this.countEvents("purchase", options);
                const visitors = await this.countEvents("visitors", options);
                const rate = visitors > 0 ? (purchases / visitors) * 100 : 0;
                return {
                    metric,
                    value: Number(rate.toFixed(2)),
                    period,
                    branch_id: options?.branch_id,
                };
            }
            case "returning_customers": {
                const events = await this.listAnalyticsEvents({
                    event_type: "purchase",
                    ...(options?.branch_id ? { branch_id: options.branch_id } : {}),
                });
                const customerCounts = new Map<string, number>();
                for (const e of events) {
                    const cid = (e as Record<string, unknown>).customer_id as string;
                    if (cid) {
                        customerCounts.set(cid, (customerCounts.get(cid) ?? 0) + 1);
                    }
                }
                const returning = Array.from(customerCounts.values()).filter(
                    (c) => c > 1
                ).length;
                return {
                    metric,
                    value: returning,
                    period,
                    branch_id: options?.branch_id,
                };
            }
            case "aov": {
                const { orders } = await this.fetchAnalyticsData();
                const filtered = this.filterOrders(orders, options);
                const totalRev = filtered.reduce((sum, o) => sum + o.total, 0);
                const count = filtered.length;
                const aov = count > 0 ? totalRev / count : 0;
                return {
                    metric,
                    value: Number(aov.toFixed(2)),
                    period,
                    branch_id: options?.branch_id,
                };
            }
            case "revenue": {
                const value = await this.totalRevenue(options);
                return { metric, value, period, branch_id: options?.branch_id };
            }
            case "expenses": {
                const value = await this.totalExpenses(options);
                return { metric, value, period, branch_id: options?.branch_id };
            }
            case "net_profit": {
                const value = await this.netProfit(options);
                return { metric, value, period, branch_id: options?.branch_id };
            }
            default:
                return { metric, value: 0, period, branch_id: options?.branch_id };
        }
    }


    // ── Expense CRUD & Validations ───────────────────────────────────────────

    private validateExpenseData(data: any): void {
        if (data.name !== undefined && (!data.name || !data.name.trim())) {
            throw new ExpenseValidationError("Expense name is required.");
        }
        if (data.amount !== undefined && (typeof data.amount !== "number" || data.amount <= 0)) {
            throw new ExpenseValidationError("Expense amount must be a positive number.");
        }
        if (data.category !== undefined) {
            const validCategories = ["rent", "utilities", "salaries", "ingredients", "marketing", "miscellaneous"];
            if (!validCategories.includes(data.category)) {
                throw new ExpenseValidationError(`Invalid expense category: ${data.category}. Must be one of: ${validCategories.join(", ")}`);
            }
        }
        if (data.expense_date !== undefined) {
            const date = new Date(data.expense_date);
            if (isNaN(date.getTime())) {
                throw new ExpenseValidationError("Invalid expense date format.");
            }
        }
    }

    async createExpense(data: any): Promise<any> {
        if (!data.name || !data.name.trim()) {
            throw new ExpenseValidationError("Expense name is required.");
        }
        if (data.amount === undefined || typeof data.amount !== "number" || data.amount <= 0) {
            throw new ExpenseValidationError("Expense amount is required and must be positive.");
        }
        if (!data.category || !data.category.trim()) {
            throw new ExpenseValidationError("Expense category is required.");
        }
        if (!data.expense_date) {
            throw new ExpenseValidationError("Expense date is required.");
        }
        this.validateExpenseData(data);

        const created = await this.createExpenses([
            {
                ...data,
                name: data.name.trim(),
                expense_date: new Date(data.expense_date),
            },
        ]);
        return created[0];
    }

    async updateExpense(id: string, data: any): Promise<any> {
        const expense = await this.retrieveExpense(id).catch(() => null);
        if (!expense) {
            throw new ExpenseNotFoundError(id);
        }
        this.validateExpenseData(data);

        const patch = { ...data };
        if (data.name !== undefined) patch.name = data.name.trim();
        if (data.expense_date !== undefined) patch.expense_date = new Date(data.expense_date);

        const updated = await this.updateExpenses({
            selector: { id },
            data: patch,
        });
        return updated[0];
    }

    async getExpense(id: string): Promise<any> {
        const expense = await this.retrieveExpense(id).catch(() => null);
        if (!expense) {
            throw new ExpenseNotFoundError(id);
        }
        return expense;
    }

    async deleteExpense(id: string): Promise<void> {
        const expense = await this.retrieveExpense(id).catch(() => null);
        if (!expense) {
            throw new ExpenseNotFoundError(id);
        }
        await this.deleteExpenses([id]);
    }

    // ── Franchise CRUD & Validations ──────────────────────────────────────────

    private validateFranchiseData(data: any): void {
        if (data.franchisee_name !== undefined && (!data.franchisee_name || !data.franchisee_name.trim())) {
            throw new FranchiseValidationError("Franchisee name is required.");
        }
        if (data.shop_id !== undefined && (!data.shop_id || !data.shop_id.trim())) {
            throw new FranchiseValidationError("Shop ID is required.");
        }
        if (data.commission_rate !== undefined && (typeof data.commission_rate !== "number" || data.commission_rate < 0 || data.commission_rate > 100)) {
            throw new FranchiseValidationError("Commission rate must be a number between 0 and 100.");
        }
    }

    async createFranchise(data: any): Promise<any> {
        if (!data.franchisee_name || !data.franchisee_name.trim()) {
            throw new FranchiseValidationError("Franchisee name is required.");
        }
        if (!data.shop_id || !data.shop_id.trim()) {
            throw new FranchiseValidationError("Shop ID is required.");
        }
        if (data.commission_rate === undefined || typeof data.commission_rate !== "number" || data.commission_rate < 0 || data.commission_rate > 100) {
            throw new FranchiseValidationError("Commission rate is required and must be between 0 and 100.");
        }
        this.validateFranchiseData(data);

        // Enforce unique branch/shop franchise agreement link
        const existing = await this.listFranchises({ shop_id: data.shop_id.trim() });
        if (existing && existing.length > 0) {
            throw new FranchiseValidationError(`A franchise agreement already exists for shop/branch: ${data.shop_id}`);
        }

        const created = await this.createFranchises([
            {
                ...data,
                franchisee_name: data.franchisee_name.trim(),
                shop_id: data.shop_id.trim(),
            },
        ]);
        return created[0];
    }

    async updateFranchise(id: string, data: any): Promise<any> {
        const franchise = await this.retrieveFranchise(id).catch(() => null);
        if (!franchise) {
            throw new FranchiseNotFoundError(id);
        }
        this.validateFranchiseData(data);

        if (data.shop_id !== undefined) {
            const existing = await this.listFranchises({ shop_id: data.shop_id.trim() });
            if (existing && existing.length > 0 && existing[0].id !== id) {
                throw new FranchiseValidationError(`A franchise agreement already exists for shop/branch: ${data.shop_id}`);
            }
        }

        const patch = { ...data };
        if (data.franchisee_name !== undefined) patch.franchisee_name = data.franchisee_name.trim();
        if (data.shop_id !== undefined) patch.shop_id = data.shop_id.trim();

        const updated = await this.updateFranchises({
            selector: { id },
            data: patch,
        });
        return updated[0];
    }

    async getFranchise(id: string): Promise<any> {
        const franchise = await this.retrieveFranchise(id).catch(() => null);
        if (!franchise) {
            throw new FranchiseNotFoundError(id);
        }
        return franchise;
    }

    async deleteFranchise(id: string): Promise<void> {
        const franchise = await this.retrieveFranchise(id).catch(() => null);
        if (!franchise) {
            throw new FranchiseNotFoundError(id);
        }
        await this.deleteFranchises([id]);
    }

    // ── Milestone 10.2: Financial & Operational Aggregations ─────────────────

    private async validateOptions(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }): Promise<void> {
        if (options?.from && isNaN(new Date(options.from).getTime())) {
            throw new AnalyticsValidationError("Invalid 'from' date.");
        }
        if (options?.to && isNaN(new Date(options.to).getTime())) {
            throw new AnalyticsValidationError("Invalid 'to' date.");
        }
        if (options?.from && options?.to && new Date(options.from) > new Date(options.to)) {
            throw new AnalyticsValidationError("'from' date cannot be after 'to' date.");
        }
        if (options?.branch_id) {
            const shopModule = this.container.shopModuleService;
            if (shopModule) {
                const exists = await shopModule.retrieveShop(options.branch_id).catch(() => null) ||
                               await shopModule.retrieveBranch(options.branch_id).catch(() => null);
                if (!exists) {
                    throw new BranchNotFoundError(options.branch_id);
                }
            }
        }
        if (options?.franchise_id) {
            const exists = await this.retrieveFranchise(options.franchise_id).catch(() => null);
            if (!exists) {
                throw new FranchiseNotFoundError(options.franchise_id);
            }
        }
    }

    private async fetchAnalyticsData(): Promise<{
        orders: Array<{
            id: string;
            total: number;
            status: string;
            created_at: Date;
            branch_id: string;
            branch_name: string;
            franchise_id?: string;
            commission_rate?: number;
        }>;
        expenses: any[];
        franchises: any[];
    }> {
        const query = this.container.query;
        if (!query) {
            return { orders: [], expenses: [], franchises: [] };
        }

        const franchises = await this.listFranchises({});

        const { data: shops } = await query.graph({
            entity: "shop",
            fields: [
                "id",
                "name",
                "deliveries.id",
                "deliveries.order.id",
                "deliveries.order.total",
                "deliveries.order.status",
                "deliveries.order.created_at",
            ],
        });

        const orders: any[] = [];
        for (const shop of (shops || [])) {
            const linkedFranchise = franchises.find((f: any) => f.shop_id === shop.id && f.is_active);
            for (const del of (shop.deliveries || [])) {
                if (del?.order) {
                    orders.push({
                        id: del.order.id,
                        total: Number(del.order.total),
                        status: del.order.status,
                        created_at: new Date(del.order.created_at),
                        branch_id: shop.id,
                        branch_name: shop.name,
                        franchise_id: linkedFranchise?.id,
                        commission_rate: linkedFranchise?.commission_rate,
                    });
                }
            }
        }

        const expenses = await this.listExpenses({});

        return { orders, expenses, franchises };
    }

    private filterOrders(
        orders: any[],
        options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }
    ): any[] {
        return orders.filter((o) => {
            if (o.status === "canceled") return false;
            if (options?.branch_id && o.branch_id !== options.branch_id) return false;
            if (options?.franchise_id && o.franchise_id !== options.franchise_id) return false;
            if (options?.from) {
                const fromTime = new Date(options.from).getTime();
                if (o.created_at.getTime() < fromTime) return false;
            }
            if (options?.to) {
                const toTime = new Date(options.to).getTime();
                if (o.created_at.getTime() > toTime) return false;
            }
            return true;
        });
    }

    private filterExpenses(
        expenses: any[],
        franchises: any[],
        options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }
    ): any[] {
        return expenses.filter((e) => {
            if (options?.branch_id && e.branch_id !== options.branch_id) return false;
            if (options?.franchise_id) {
                const fran = franchises.find((f: any) => f.id === options.franchise_id);
                if (!fran || e.branch_id !== fran.shop_id) return false;
            }
            const expDate = new Date(e.expense_date);
            if (options?.from) {
                const fromTime = new Date(options.from).getTime();
                if (expDate.getTime() < fromTime) return false;
            }
            if (options?.to) {
                const toTime = new Date(options.to).getTime();
                if (expDate.getTime() > toTime) return false;
            }
            return true;
        });
    }

    async totalRevenue(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }): Promise<number> {
        await this.validateOptions(options);
        const { orders } = await this.fetchAnalyticsData();
        const filtered = this.filterOrders(orders, options);
        return filtered.reduce((sum, o) => sum + o.total, 0);
    }

    async totalExpenses(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }): Promise<number> {
        await this.validateOptions(options);
        const { expenses, franchises } = await this.fetchAnalyticsData();
        const filtered = this.filterExpenses(expenses, franchises, options);
        return filtered.reduce((sum, e) => sum + e.amount, 0);
    }

    async netProfit(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string }): Promise<number> {
        const rev = await this.totalRevenue(options);
        const exp = await this.totalExpenses(options);
        return rev - exp;
    }

    async branchRevenue(options?: { from?: Date; to?: Date }): Promise<any[]> {
        await this.validateOptions(options);
        const { orders, expenses, franchises } = await this.fetchAnalyticsData();
        
        const branchMap = new Map<string, { branch_id: string; branch_name: string; revenue: number; expenses: number; net_profit: number }>();

        // We fetch the shops list to ensure branches with 0 revenue are listed
        const query = this.container.query;
        if (query) {
            const { data: shops } = await query.graph({ entity: "shop", fields: ["id", "name"] });
            for (const s of (shops || [])) {
                branchMap.set(s.id, {
                    branch_id: s.id,
                    branch_name: s.name,
                    revenue: 0,
                    expenses: 0,
                    net_profit: 0,
                });
            }
        }

        const filteredOrders = this.filterOrders(orders, options);
        for (const o of filteredOrders) {
            const record = branchMap.get(o.branch_id) || {
                branch_id: o.branch_id,
                branch_name: o.branch_name,
                revenue: 0,
                expenses: 0,
                net_profit: 0,
            };
            record.revenue += o.total;
            record.net_profit += o.total;
            branchMap.set(o.branch_id, record);
        }

        const filteredExpenses = this.filterExpenses(expenses, franchises, options);
        for (const e of filteredExpenses) {
            const record = branchMap.get(e.branch_id) || {
                branch_id: e.branch_id,
                branch_name: `Branch ${e.branch_id}`,
                revenue: 0,
                expenses: 0,
                net_profit: 0,
            };
            record.expenses += e.amount;
            record.net_profit -= e.amount;
            branchMap.set(e.branch_id, record);
        }

        return Array.from(branchMap.values());
    }

    async franchiseRevenue(options?: { from?: Date; to?: Date }): Promise<any[]> {
        await this.validateOptions(options);
        const { orders, franchises } = await this.fetchAnalyticsData();
        const filteredOrders = this.filterOrders(orders, options);

        return franchises.map((f: any) => {
            const shopOrders = filteredOrders.filter((o) => o.branch_id === f.shop_id);
            const order_revenue = shopOrders.reduce((sum, o) => sum + o.total, 0);
            const commission = Math.round(order_revenue * (f.commission_rate / 100));
            return {
                franchise_id: f.id,
                franchisee_name: f.franchisee_name,
                shop_id: f.shop_id,
                order_revenue,
                commission,
            };
        });
    }

    private groupTrend(
        items: Array<{ date: Date; value: number }>,
        interval: "daily" | "weekly" | "monthly"
    ): Array<{ date: string; value: number }> {
        const groups = new Map<string, number>();

        for (const item of items) {
            let key = "";
            if (interval === "daily") {
                key = item.date.toISOString().split("T")[0];
            } else if (interval === "weekly") {
                const date = new Date(item.date);
                const day = date.getDay();
                const diff = date.getDate() - day;
                const sunday = new Date(date.setDate(diff));
                key = sunday.toISOString().split("T")[0];
            } else if (interval === "monthly") {
                key = item.date.toISOString().slice(0, 7);
            }
            groups.set(key, (groups.get(key) || 0) + item.value);
        }

        return Array.from(groups.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    async revenueTrend(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string; interval?: "daily" | "weekly" | "monthly" }): Promise<any[]> {
        await this.validateOptions(options);
        const { orders } = await this.fetchAnalyticsData();
        const filtered = this.filterOrders(orders, options);

        const trendItems = filtered.map((o) => ({ date: o.created_at, value: o.total }));
        return this.groupTrend(trendItems, options?.interval || "daily");
    }

    async expenseTrend(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string; interval?: "daily" | "weekly" | "monthly" }): Promise<any[]> {
        await this.validateOptions(options);
        const { expenses, franchises } = await this.fetchAnalyticsData();
        const filtered = this.filterExpenses(expenses, franchises, options);

        const trendItems = filtered.map((e) => ({ date: new Date(e.expense_date), value: e.amount }));
        return this.groupTrend(trendItems, options?.interval || "daily");
    }

    async getDashboardSummary(options?: { from?: Date; to?: Date; branch_id?: string; franchise_id?: string; interval?: "daily" | "weekly" | "monthly" }): Promise<any> {
        await this.validateOptions(options);
        const revenue = await this.totalRevenue(options);
        const expenses = await this.totalExpenses(options);
        const net_profit = revenue - expenses;
        const sales_trends = await this.revenueTrend(options);
        const expense_trends = await this.expenseTrend(options);
        const branch_summaries = await this.branchRevenue({ from: options?.from, to: options?.to });
        const franchise_summaries = await this.franchiseRevenue({ from: options?.from, to: options?.to });

        return {
            revenue,
            expenses,
            net_profit,
            sales_trends,
            expense_trends,
            branch_summaries,
            franchise_summaries,
        };
    }

    async dailySummary(options?: { branch_id?: string; franchise_id?: string }): Promise<any> {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        return this.getDashboardSummary({ ...options, from, to, interval: "daily" });
    }

    async weeklySummary(options?: { branch_id?: string; franchise_id?: string }): Promise<any> {
        const from = new Date();
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        return this.getDashboardSummary({ ...options, from, to, interval: "daily" });
    }

    async monthlySummary(options?: { branch_id?: string; franchise_id?: string }): Promise<any> {
        const from = new Date();
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        return this.getDashboardSummary({ ...options, from, to, interval: "daily" });
    }

    async getGstReport(options?: { from?: Date; to?: Date; branch_id?: string }): Promise<any> {
        await this.validateOptions(options);
        const { orders } = await this.fetchAnalyticsData();
        const filtered = this.filterOrders(orders, options);

        const order_revenue = filtered.reduce((sum, o) => sum + o.total, 0);
        const gst_collected = Math.round(order_revenue * 0.18); // 18% inclusive GST
        const cgst = Math.round(gst_collected / 2);
        const sgst = Math.round(gst_collected / 2);

        return {
            order_revenue,
            gst_collected,
            cgst,
            sgst,
            gst_rate: 18,
            order_count: filtered.length,
        };
    }

    async getCustomerRetentionReport(options?: { from?: Date; to?: Date; branch_id?: string }): Promise<any> {
        await this.validateOptions(options);
        const { orders } = await this.fetchAnalyticsData();
        const filtered = this.filterOrders(orders, options);

        const customerOrders = new Map<string, number>();
        for (const o of filtered) {
            const cid = o.customer_id || (o as any).email || "guest";
            customerOrders.set(cid, (customerOrders.get(cid) || 0) + 1);
        }

        const total = customerOrders.size;
        const repeat = Array.from(customerOrders.values()).filter((cnt) => cnt > 1).length;
        const rate = total > 0 ? (repeat / total) * 100 : 0;

        return {
            total_customers: total,
            repeat_customers: repeat,
            retention_rate: Number(rate.toFixed(2)),
            churn_rate: Number((100 - rate).toFixed(2)),
        };
    }

    async getCampaignRoiReport(options?: { from?: Date; to?: Date }): Promise<any[]> {
        await this.validateOptions(options);
        const marketingService = this.container.marketingModuleService;
        const campaigns = marketingService ? await marketingService.listCampaigns({}) : [];

        const { orders } = await this.fetchAnalyticsData();
        const filteredOrders = this.filterOrders(orders, options);

        return campaigns.map((c: any) => {
            const conversions = filteredOrders.filter((o) => o.campaign_id === c.id || (o as any).coupon_code === c.coupon_code);
            const conversion_value = conversions.reduce((sum, o) => sum + o.total, 0);
            const spend = c.budget || 10000; // default spend fallback
            const roi = spend > 0 ? ((conversion_value - spend) / spend) * 100 : 0;

            return {
                campaign_id: c.id,
                campaign_name: c.name,
                spend,
                conversions_count: conversions.length,
                conversion_value,
                roi: Number(roi.toFixed(2)),
            };
        });
    }

    async getStaffPerformanceReport(options?: { from?: Date; to?: Date; branch_id?: string }): Promise<any[]> {
        await this.validateOptions(options);
        const deliveryService = this.container.deliveryModuleService;
        const deliveries = deliveryService ? await deliveryService.listDeliveries({}) : [];

        const from = options?.from?.getTime() ?? 0;
        const to = options?.to?.getTime() ?? Date.now();

        const filtered = deliveries.filter((d: any) => {
            const createdAt = new Date(d.created_at || Date.now()).getTime();
            if (createdAt < from || createdAt > to) return false;
            if (options?.branch_id && d.branch_id !== options.branch_id) return false;
            return true;
        });

        const driverMap = new Map<string, { driver_id: string; total_deliveries: number; completed_deliveries: number; failed_deliveries: number }>();

        for (const d of filtered) {
            const driverId = d.delivery_partner_id || "unassigned";
            const current = driverMap.get(driverId) || {
                driver_id: driverId,
                total_deliveries: 0,
                completed_deliveries: 0,
                failed_deliveries: 0,
            };

            current.total_deliveries += 1;
            if (d.delivery_status === "delivered") {
                current.completed_deliveries += 1;
            } else if (d.delivery_status === "canceled" || d.delivery_status === "failed") {
                current.failed_deliveries += 1;
            }
            driverMap.set(driverId, current);
        }

        return Array.from(driverMap.values()).map((drv) => {
            const success_rate = drv.total_deliveries > 0 ? (drv.completed_deliveries / drv.total_deliveries) * 100 : 0;
            return {
                ...drv,
                success_rate: Number(success_rate.toFixed(2)),
            };
        });
    }

    // ── Export Framework ──────────────────────────────────────────────────

    exportToCsv(headers: string[], rows: any[][]): string {
        const headerRow = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",");
        const bodyRows = rows.map(row => {
            return row.map(cell => {
                const cellStr = cell === null || cell === undefined ? "" : String(cell);
                return `"${cellStr.replace(/"/g, '""')}"`;
            }).join(",");
        }).join("\n");

        return `${headerRow}\n${bodyRows}`;
    }

    // ── ReportSchedule CRUD ────────────────────────────────────────────────

    async createReportSchedule(data: any): Promise<any> {
        if (!data.recipient_email || !data.recipient_email.trim()) {
            throw new AnalyticsValidationError("Recipient email is required.");
        }
        if (!data.report_type) {
            throw new AnalyticsValidationError("Report type is required.");
        }
        if (!data.frequency) {
            throw new AnalyticsValidationError("Frequency is required.");
        }

        const created = await this.createReportSchedules([
            {
                recipient_email: data.recipient_email.trim(),
                report_type: data.report_type,
                frequency: data.frequency,
                branch_id: data.branch_id || null,
                last_sent_at: null,
            },
        ]);
        return created[0];
    }

    async updateReportSchedule(id: string, data: any): Promise<any> {
        const schedule = await this.retrieveReportSchedule(id).catch(() => null);
        if (!schedule) {
            throw new AnalyticsValidationError(`Report schedule ${id} not found.`);
        }

        const patch: Record<string, any> = {};
        if (data.recipient_email !== undefined) patch.recipient_email = data.recipient_email.trim();
        if (data.report_type !== undefined) patch.report_type = data.report_type;
        if (data.frequency !== undefined) patch.frequency = data.frequency;
        if (data.branch_id !== undefined) patch.branch_id = data.branch_id;
        if (data.last_sent_at !== undefined) patch.last_sent_at = data.last_sent_at;

        const updated = await this.updateReportSchedules({
            selector: { id },
            data: patch,
        });
        return updated[0];
    }

    async deleteReportSchedule(id: string): Promise<void> {
        const schedule = await this.retrieveReportSchedule(id).catch(() => null);
        if (!schedule) {
            throw new AnalyticsValidationError(`Report schedule ${id} not found.`);
        }
        await this.deleteReportSchedules([id]);
    }

    async getReportSchedule(id: string): Promise<any> {
        const schedule = await this.retrieveReportSchedule(id).catch(() => null);
        if (!schedule) {
            throw new AnalyticsValidationError(`Report schedule ${id} not found.`);
        }
        return schedule;
    }
}

export default AnalyticsModuleService;

