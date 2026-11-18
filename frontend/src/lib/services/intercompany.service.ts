/**
 * Parent company purchases (optional). Our stores buy what they sell from the parent company (e.g. Baked).
 * Each purchase bill is posted against the parent supplier and shows in Bills Payable under its name.
 *
 * Billing (super admin chooses):
 *  - PERIODIC (default): one bill per period — DAILY, WEEKLY (Mon–Sun), SEMI_MONTHLY (1–15, 16–end) or
 *    MONTHLY — either per branch or one combined bill for all branches (posted under the billing branch).
 *    Those sales were already posted, so the bill's cost goes straight to COGS: purchase (Dr 1132 [+ Input
 *    GST] / Cr 2111) then Dr 5110 COGS (per selling branch) / Cr 1132, and its cost lots are closed.
 *  - PER_ORDER: one bill per delivered order, posted before the sale so the sale consumes it as COGS.
 *
 * Price paid to the parent (super admin chooses):
 *  - PERCENT_OF_SALE: a % of each line's sale value.
 *  - PRODUCT_COST: the product's cost price (per weight if set). Lines without a cost price are reported.
 *  - COST_ELSE_PERCENT: product cost price when set, otherwise the %.
 *
 * GST: WITH_GST (parent must have a GSTIN; input tax credit) or WITHOUT_GST (e.g. before registration).
 * Marketplace partner orders are never included. Config: setting(group='intercompany', key='parent_company').
 */

import type { PoolClient } from "pg";
import { dbQuery, dbTransaction } from "../db";

export type ParentPriceMethod = "PERCENT_OF_SALE" | "PRODUCT_COST" | "COST_ELSE_PERCENT";
export type ParentBillingMode = "PERIODIC" | "PER_ORDER";
export type ParentBillingFrequency = "DAILY" | "WEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
export type ParentBillScope = "PER_BRANCH" | "ALL_BRANCHES";

export interface ParentCompanyConfig {
  enabled: boolean;
  supplier_id: string | null;
  price_method: ParentPriceMethod;
  transfer_price_pct: number;
  billing_mode: ParentBillingMode;
  billing_frequency: ParentBillingFrequency;
  bill_scope: ParentBillScope;
  /** Branch a combined (all-branch) bill is recorded under. */
  billing_branch_id: string | null;
  gst_mode: "WITH_GST" | "WITHOUT_GST";
  include_accessories: boolean;
  credit_days: number;
}

export const DEFAULT_PARENT_CONFIG: ParentCompanyConfig = {
  enabled: false,
  supplier_id: null,
  price_method: "PERCENT_OF_SALE",
  transfer_price_pct: 100,
  billing_mode: "PERIODIC",
  billing_frequency: "DAILY",
  bill_scope: "PER_BRANCH",
  billing_branch_id: null,
  gst_mode: "WITHOUT_GST",
  include_accessories: false,
  credit_days: 30,
};

const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;
const SETTING_ID = "set_intercompany_parent_company";
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);
type Q = (s: string, p?: any[]) => Promise<any>;

export async function getParentCompanyConfig(q: Q = dbQuery): Promise<ParentCompanyConfig> {
  const r = await q(`SELECT value FROM public.setting WHERE id = $1 AND deleted_at IS NULL`, [SETTING_ID]).catch(() => ({ rows: [] }));
  const raw = r.rows[0]?.value;
  let v: any = {};
  try { v = typeof raw === "string" ? JSON.parse(raw) : raw || {}; } catch {}
  if (v.billing_mode === "DAILY_PER_BRANCH") v = { ...v, billing_mode: "PERIODIC", billing_frequency: "DAILY", bill_scope: "PER_BRANCH" };
  return { ...DEFAULT_PARENT_CONFIG, ...v };
}

export async function saveParentCompanyConfig(input: Partial<ParentCompanyConfig>): Promise<ParentCompanyConfig> {
  const priceMethod: ParentPriceMethod = ["PRODUCT_COST", "COST_ELSE_PERCENT"].includes(String(input.price_method)) ? (input.price_method as ParentPriceMethod) : "PERCENT_OF_SALE";
  const pct = Number(input.transfer_price_pct ?? 100);
  if (priceMethod !== "PRODUCT_COST" && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) {
    throw new Error("Price % must be between 1 and 100 of the sale value.");
  }
  const gstMode = input.gst_mode === "WITH_GST" ? "WITH_GST" : "WITHOUT_GST";
  const supplierId = input.supplier_id ? String(input.supplier_id) : null;
  if (input.enabled && !supplierId) throw new Error("Choose the parent company (supplier) before turning this on.");
  if (supplierId) {
    const s = await dbQuery(`SELECT id, gstin FROM public.supplier WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
    if (!s.rows[0]) throw new Error("Parent company supplier not found.");
    if (gstMode === "WITH_GST" && !s.rows[0].gstin) throw new Error("The parent company has no GSTIN. Add its GSTIN or choose 'Without GST'.");
  }
  const cfg: ParentCompanyConfig = {
    enabled: Boolean(input.enabled),
    supplier_id: supplierId,
    price_method: priceMethod,
    transfer_price_pct: Number.isFinite(pct) && pct > 0 ? r2(Math.min(pct, 100)) : 100,
    billing_mode: input.billing_mode === "PER_ORDER" ? "PER_ORDER" : "PERIODIC",
    billing_frequency: (["WEEKLY", "SEMI_MONTHLY", "MONTHLY"].includes(String(input.billing_frequency)) ? input.billing_frequency : "DAILY") as ParentBillingFrequency,
    bill_scope: input.bill_scope === "ALL_BRANCHES" ? "ALL_BRANCHES" : "PER_BRANCH",
    billing_branch_id: input.billing_branch_id ? String(input.billing_branch_id) : null,
    gst_mode: gstMode,
    include_accessories: Boolean(input.include_accessories),
    credit_days: Math.max(0, Math.min(180, Number(input.credit_days ?? 30) || 0)),
  };
  await dbQuery(
    `INSERT INTO public.setting (id, "group", key, value, is_json, is_secret, created_at, updated_at)
     VALUES ($1, 'intercompany', 'parent_company', $2, true, false, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, is_json = true, updated_at = NOW(), deleted_at = NULL`,
    [SETTING_ID, JSON.stringify(cfg)]
  );
  return cfg;
}

/** Cost price the parent charges for one sold unit: per-weight cost if set, else product cost. */
function productCostPrice(product: any, item: any): number {
  const meta = product?.metadata || {};
  const weight = String(item.weight || item.variant_name || "").toLowerCase();
  const wps: any[] = Array.isArray(meta.weight_prices) ? meta.weight_prices : [];
  const wp = wps.find((w) => String(w.weight_name || "").toLowerCase() === weight);
  const c = Number(wp?.cost_price || meta.cost_price || 0);
  return c > 0 ? r2(c) : 0;
}

interface BuiltLine { item: any; orderId: string; orderNumber: string }

async function buildBillItems(q: Q, cfg: ParentCompanyConfig, lines: BuiltLine[]) {
  const ids = [...new Set(lines.map((l) => l.item.product_id).filter(Boolean))];
  const prods = ids.length ? (await q(`SELECT id, metadata FROM public.product WHERE id = ANY($1::text[])`, [ids])).rows : [];
  const byId = new Map(prods.map((p: any) => [p.id, p]));
  const withGst = cfg.gst_mode === "WITH_GST";
  const missingCost: string[] = [];
  let subtotal = 0, cgst = 0, sgst = 0;
  const items: any[] = [];
  for (const { item: i, orderNumber } of lines) {
    const qty = Math.max(1, Number(i.quantity || 1));
    const salePrice = Number(i.unit_price ?? i.price ?? 0);
    const cost = productCostPrice(byId.get(i.product_id), i);
    let rate = 0;
    if (cfg.price_method === "PRODUCT_COST") {
      if (cost <= 0) { missingCost.push(String(i.title || i.product_name || i.product_id)); continue; }
      rate = cost;
    } else if (cfg.price_method === "COST_ELSE_PERCENT" && cost > 0) {
      rate = cost;
    } else {
      rate = r2((salePrice * cfg.transfer_price_pct) / 100);
    }
    const taxable = r2(rate * qty);
    const gstRate = withGst ? Number(i.tax_rate ?? i.gst_rate_pct ?? 5) : 0;
    const half = gstRate / 2;
    const lc = withGst ? r2((taxable * half) / 100) : 0;
    const ls = withGst ? r2((taxable * half) / 100) : 0;
    subtotal = r2(subtotal + taxable);
    cgst = r2(cgst + lc);
    sgst = r2(sgst + ls);
    const isAcc = String(i.merchandise_type || "").toUpperCase() === "ACCESSORY";
    items.push({
      product_id: i.product_id || null,
      variant_id: i.variant_id || null,
      item_type: isAcc ? "ACCESSORY" : "CAKE",
      description: `${String(i.title || i.product_name || "Cake").slice(0, 150)}${orderNumber ? ` (order ${orderNumber})` : ""}`,
      quantity: qty,
      rate,
      taxable_value: taxable,
      cgst_rate: withGst ? half : 0,
      sgst_rate: withGst ? half : 0,
      igst_rate: 0,
      cgst: lc,
      sgst: ls,
      igst: 0,
      total: r2(taxable + lc + ls),
      hsn_code: i.hsn_code || (isAcc ? "95059000" : "19059010"),
    });
  }
  return { items, subtotal, cgst, sgst, total: r2(subtotal + cgst + sgst), missingCost };
}

function eligibleLines(cfg: ParentCompanyConfig, meta: any) {
  const allowed = new Set(["CAKE", ...(cfg.include_accessories ? ["ACCESSORY"] : [])]);
  return (Array.isArray(meta?.items) ? meta.items : []).filter((i: any) => allowed.has(String(i.merchandise_type || "CAKE").toUpperCase()));
}

/** Create, approve (maker-checker via system actors) and post one parent bill. */
async function createAndPostBill(params: {
  cfg: ParentCompanyConfig; branchId: string; invoiceNo: string; billDate: string; built: Awaited<ReturnType<typeof buildBillItems>>; metadata: Record<string, unknown>;
}): Promise<{ ok: true; purchaseId: string } | { ok: false; reason: string }> {
  const { cfg, built } = params;
  const due = new Date(new Date(`${params.billDate}T00:00:00Z`).getTime() + cfg.credit_days * 86400000).toISOString().slice(0, 10);
  const { PurchaseService } = await import("./purchase.service");
  const created = await PurchaseService.createPurchase(
    {
      supplier_id: cfg.supplier_id,
      invoice_no: params.invoiceNo.slice(0, 60),
      invoice_date: params.billDate,
      subtotal: built.subtotal,
      discount: 0,
      taxable_value: built.subtotal,
      cgst: built.cgst,
      sgst: built.sgst,
      igst: 0,
      total: built.total,
      credit_terms_days: cfg.credit_days,
      due_date: due,
      metadata: { intercompany: true, gst_mode: cfg.gst_mode, price_method: cfg.price_method, transfer_price_pct: cfg.transfer_price_pct, ...params.metadata },
      items: built.items,
    } as any,
    params.branchId,
    "system:intercompany"
  );
  if (!created.success || !created.data) return { ok: false, reason: `purchase create failed: ${created.error}` };
  const purchaseId = (created.data as any).id;
  // Separate system actors keep maker-checker intact: purchase approver ≠ voucher approver.
  for (const [status, by] of [["SUBMITTED", "system:intercompany_maker"], ["APPROVED", "system:intercompany_purchase_approver"]] as const) {
    const t = await PurchaseService.transitionStatus(purchaseId, status as any, by, true);
    if (!t.success) return { ok: false, reason: `purchase ${status.toLowerCase()} failed: ${t.error}` };
  }
  const { PurchasePostingService } = await import("./purchase-posting.service");
  const posted = await PurchasePostingService.prepareAndPostPurchase({
    purchaseId,
    voucherCreatedBy: "system:intercompany_maker",
    voucherApprovedBy: "system:intercompany_checker",
    postedBy: "system:intercompany_checker",
    actorRole: "SUPER_ADMIN",
    branchId: params.branchId,
  });
  if (!posted.success) return { ok: false, reason: `purchase posting failed: ${posted.error} (${(posted as any).code})` };
  return { ok: true, purchaseId };
}

export type ParentPurchaseOutcome = { created: false; reason: string } | { created: true; purchase_id: string; total: number };

/** PER_ORDER mode: bill one delivered order (called on delivery, before the sale is posted). Idempotent. */
export async function createParentPurchaseForOrder(orderId: string): Promise<ParentPurchaseOutcome> {
  const cfg = await getParentCompanyConfig();
  if (!cfg.enabled || !cfg.supplier_id) return { created: false, reason: "disabled" };
  if (cfg.billing_mode !== "PER_ORDER") return { created: false, reason: "periodic billing" };
  const o = (await dbQuery(`SELECT id, order_number, branch_id, metadata FROM public."order" WHERE id = $1 AND deleted_at IS NULL`, [orderId])).rows[0];
  if (!o) return { created: false, reason: "order not found" };
  const branchId = o.branch_id || o.metadata?.branch_id;
  if (!branchId) return { created: false, reason: "order has no branch" };
  if ((await dbQuery(`SELECT 1 FROM public.marketplace_order_snapshot WHERE order_id = $1 LIMIT 1`, [orderId])).rows.length) return { created: false, reason: "marketplace partner order" };
  if (o.metadata?.parent_purchase_id) return { created: false, reason: "already created" };
  const lines = eligibleLines(cfg, o.metadata).map((item: any) => ({ item, orderId: o.id, orderNumber: o.order_number }));
  if (!lines.length) return { created: false, reason: "no parent-supplied items" };
  const built = await buildBillItems(dbQuery, cfg, lines);
  if (built.missingCost.length) return { created: false, reason: `no cost price set for: ${built.missingCost.join(", ")}` };
  if (built.total <= 0) return { created: false, reason: "zero value" };
  const res = await createAndPostBill({ cfg, branchId, invoiceNo: `BKD-${o.order_number || o.id}`, billDate: istDate(), built, metadata: { source_order_id: o.id, source_order_number: o.order_number, order_ids: [o.id] } });
  if (!res.ok) return { created: false, reason: res.reason };
  await dbQuery(`UPDATE public."order" SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('parent_purchase_id', $2::text) WHERE id = $1`, [o.id, res.purchaseId]);
  return { created: true, purchase_id: res.purchaseId, total: built.total };
}

/** Billing period containing `date` (IST, YYYY-MM-DD). */
export function billingPeriod(date: string, freq: ParentBillingFrequency): { start: string; end: string; key: string; label: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const ymd = (x: Date) => x.toISOString().slice(0, 10);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const monthEnd = new Date(Date.UTC(y, m + 1, 0));
  if (freq === "WEEKLY") {
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(Date.UTC(y, m, day - dow));
    const end = new Date(Date.UTC(y, m, day - dow + 6));
    return { start: ymd(start), end: ymd(end), key: `W${ymd(start).replace(/-/g, "")}`, label: `week of ${ymd(start)}` };
  }
  if (freq === "SEMI_MONTHLY") {
    const first = day <= 15;
    const start = new Date(Date.UTC(y, m, first ? 1 : 16));
    const end = first ? new Date(Date.UTC(y, m, 15)) : monthEnd;
    return { start: ymd(start), end: ymd(end), key: `${ymd(start).slice(0, 7).replace("-", "")}${first ? "A" : "B"}`, label: `${ymd(start)} to ${ymd(end)}` };
  }
  if (freq === "MONTHLY") {
    const start = new Date(Date.UTC(y, m, 1));
    return { start: ymd(start), end: ymd(monthEnd), key: ymd(start).slice(0, 7).replace("-", ""), label: ymd(start).slice(0, 7) };
  }
  return { start: date, end: date, key: date.replace(/-/g, ""), label: date };
}

/** Delivered (invoiced) own-store orders in [start, end] not yet billed by the parent. */
async function pendingOrdersBetween(q: Q, start: string, end: string, branchId?: string) {
  const r = await q(
    `SELECT o.id, o.order_number, o.branch_id, o.metadata
       FROM public."order" o
       JOIN public.invoice i ON i.order_id = o.id AND i.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND (i.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date
        AND COALESCE(o.metadata->>'parent_purchase_id', '') = ''
        AND NOT EXISTS (SELECT 1 FROM public.marketplace_order_snapshot m WHERE m.order_id = o.id)
        AND ($3::text IS NULL OR o.branch_id = $3)
      ORDER BY o.branch_id, o.created_at`,
    [start, end, branchId || null]
  );
  return r.rows;
}

export interface PeriodBillResult { period: string; branch_id: string; created: boolean; purchase_id?: string; total?: number; orders: number; reason?: string }

async function resolveBillingBranch(cfg: ParentCompanyConfig): Promise<string | null> {
  if (cfg.billing_branch_id) {
    const r = await dbQuery(`SELECT id FROM public.branch WHERE id = $1 AND deleted_at IS NULL`, [cfg.billing_branch_id]);
    if (r.rows[0]) return r.rows[0].id;
  }
  const r = await dbQuery(`SELECT id FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`);
  return r.rows[0]?.id || null;
}

/**
 * PERIODIC mode: raise the parent bill(s) for the period containing `date` (default today), covering orders
 * delivered from the period start up to `date`. Per branch, or one combined bill for all branches.
 * Safe to run repeatedly: each order is billed once (order.metadata.parent_purchase_id).
 */
export async function raisePeriodParentBills(params: { date?: string; branchId?: string } = {}): Promise<PeriodBillResult[]> {
  const cfg = await getParentCompanyConfig();
  if (!cfg.enabled || !cfg.supplier_id || cfg.billing_mode !== "PERIODIC") return [];
  const date = params.date || istDate();
  const period = billingPeriod(date, cfg.billing_frequency);
  const until = date < period.end ? date : period.end;
  const orders = await pendingOrdersBetween(dbQuery, period.start, until, params.branchId);
  if (!orders.length) return [];

  const groups = new Map<string, any[]>();
  if (cfg.bill_scope === "ALL_BRANCHES" && !params.branchId) {
    const billingBranch = await resolveBillingBranch(cfg);
    if (!billingBranch) return [{ period: period.label, branch_id: "", created: false, orders: orders.length, reason: "no billing branch" }];
    groups.set(billingBranch, orders.filter((o: any) => o.branch_id));
  } else {
    for (const o of orders) {
      if (!o.branch_id) continue;
      if (!groups.has(o.branch_id)) groups.set(o.branch_id, []);
      groups.get(o.branch_id)!.push(o);
    }
  }

  const results: PeriodBillResult[] = [];
  for (const [billBranch, list] of groups) {
    const lines: BuiltLine[] = [];
    const costByBranch = new Map<string, BuiltLine[]>();
    for (const o of list) {
      for (const item of eligibleLines(cfg, o.metadata)) {
        const l = { item, orderId: o.id, orderNumber: o.order_number };
        lines.push(l);
        if (!costByBranch.has(o.branch_id)) costByBranch.set(o.branch_id, []);
        costByBranch.get(o.branch_id)!.push(l);
      }
    }
    if (!lines.length) { results.push({ period: period.label, branch_id: billBranch, created: false, orders: list.length, reason: "no parent-supplied items" }); continue; }
    const built = await buildBillItems(dbQuery, cfg, lines);
    if (built.missingCost.length) { results.push({ period: period.label, branch_id: billBranch, created: false, orders: list.length, reason: `no cost price set for: ${[...new Set(built.missingCost)].join(", ")}` }); continue; }
    if (built.total <= 0) { results.push({ period: period.label, branch_id: billBranch, created: false, orders: list.length, reason: "zero value" }); continue; }
    // COGS per selling branch (keeps branch profit right even on a combined bill)
    const cogsSplit: Array<{ branchId: string; amount: number }> = [];
    for (const [br, ls] of costByBranch) {
      const part = await buildBillItems(dbQuery, cfg, ls);
      cogsSplit.push({ branchId: br, amount: part.subtotal });
    }
    const scopeTag = cfg.bill_scope === "ALL_BRANCHES" && !params.branchId ? "ALL" : String(billBranch).slice(-6).toUpperCase();
    const seq = (await dbQuery(
      `SELECT COUNT(*)::int n FROM public.purchase WHERE metadata->>'intercompany_period_key' = $1 AND metadata->>'intercompany_scope_tag' = $2 AND deleted_at IS NULL`,
      [period.key, scopeTag]
    )).rows[0].n;
    const invoiceNo = `BKD-${period.key}-${scopeTag}${seq ? `-${seq + 1}` : ""}`;
    const orderIds = list.map((o: any) => o.id);
    const res = await createAndPostBill({
      cfg, branchId: billBranch, invoiceNo, billDate: until, built,
      metadata: { intercompany_period_key: period.key, intercompany_period: period.label, intercompany_scope_tag: scopeTag, intercompany_bill_date: until, order_ids: orderIds },
    });
    if (!res.ok) { results.push({ period: period.label, branch_id: billBranch, created: false, orders: list.length, reason: res.reason }); continue; }
    await moveBillCostToCogs(res.purchaseId, billBranch, until, cogsSplit);
    await dbQuery(
      `UPDATE public."order" SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('parent_purchase_id', $2::text) WHERE id = ANY($1::text[])`,
      [orderIds, res.purchaseId]
    );
    results.push({ period: period.label, branch_id: billBranch, created: true, purchase_id: res.purchaseId, total: built.total, orders: list.length });
  }
  return results;
}

/** Back-compat name used by tests/routes: bill the day (or the current period) for `date`. */
export const raiseDailyParentBills = (params: { date?: string; branchId?: string } = {}) => raisePeriodParentBills(params);

/** Already-sold goods: Dr 5110 COGS - Cakes / Cr 1132 Cake inventory for the bill's cost, and close its lots. */
async function moveBillCostToCogs(purchaseId: string, branchId: string, date: string, split: Array<{ branchId: string; amount: number }>) {
  const parts = split.filter((x) => x.amount > 0);
  const amount = r2(parts.reduce((t, x) => t + x.amount, 0));
  if (amount <= 0) return;
  const { PostingService } = await import("./posting.service");
  const { AccountingAccountRepository } = await import("../repositories/accounting-account.repository");
  await dbTransaction(async (c: PoolClient) => {
    const cogs = await AccountingAccountRepository.findByCode("5110", c);
    const inv = await AccountingAccountRepository.findByCode("1132", c);
    if (!cogs || !inv) throw new Error("COGS 5110 / Inventory 1132 account missing.");
    const fiscal = await PostingService.validateFiscalPeriod(date, c);
    const draft = await PostingService.createVoucherDraft({
      input: {
        voucher_type: "JOURNAL",
        voucher_date: date,
        branch_id: branchId,
        narration: `Cost of goods sold: parent company bill to ${date}`,
        reference_type: "PURCHASE",
        reference_id: purchaseId,
        reference_event: "PARENT_COGS",
        metadata: { purchase_id: purchaseId, intercompany: true },
      },
      branchId,
      fiscalYear: fiscal.fiscal_year,
      createdBy: "system:intercompany_maker",
      client: c,
    });
    if (!draft.success || !draft.data) throw new Error((draft as any).error || "COGS voucher draft failed.");
    const v = draft.data;
    const s = await PostingService.submitVoucher({ voucherId: v.id, submittedBy: "system:intercompany_maker", branchId, client: c });
    if (!s.success) throw new Error((s as any).error || "COGS voucher submit failed.");
    const a = await PostingService.approveVoucher({ voucherId: v.id, approvedBy: "system:intercompany_checker", branchId, client: c });
    if (!a.success) throw new Error((a as any).error || "COGS voucher approve failed.");
    const p = await PostingService.postVoucher({
      voucherId: v.id,
      postedBy: "system:intercompany_checker",
      branchId,
      client: c,
      lines: [
        ...parts.map((x) => ({ account_id: cogs.id, debit_amount: r2(x.amount), credit_amount: 0, branch_id: x.branchId, narration: "Parent company cost of cakes sold" })),
        { account_id: inv.id, debit_amount: 0, credit_amount: amount, branch_id: branchId, narration: "Parent company cost of cakes sold" },
      ],
    });
    if (!p.success) throw new Error((p as any).error || "COGS voucher post failed.");
    await c.query(`UPDATE public.inventory_cost_lot SET remaining_quantity = 0, status = 'DEPLETED', updated_at = NOW() WHERE purchase_id = $1`, [purchaseId]);
  });
}

/** Catch-up: bill every closed period with unbilled orders in the last `daysBack` days. */
export async function raisePendingParentBills(daysBack = 62): Promise<PeriodBillResult[]> {
  const cfg = await getParentCompanyConfig();
  if (!cfg.enabled || cfg.billing_mode !== "PERIODIC") return [];
  const today = istDate();
  const seen = new Set<string>();
  const out: PeriodBillResult[] = [];
  for (let d = daysBack; d >= 1; d--) {
    const day = istDate(-d);
    const period = billingPeriod(day, cfg.billing_frequency);
    if (period.end >= today || seen.has(period.key)) continue; // only closed periods
    seen.add(period.key);
    out.push(...(await raisePeriodParentBills({ date: period.end })));
  }
  return out;
}
