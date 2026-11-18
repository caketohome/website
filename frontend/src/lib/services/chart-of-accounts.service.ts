/**
 * Chart of Accounts management: list ledgers with live balances, create ledgers/groups under a group,
 * rename, and (de)activate. Ledgers created automatically (banks 1112-NN, partners 2112-NN, system
 * accounts) appear here too. System ledgers can't be renamed or deactivated; a ledger with a balance
 * can't be deactivated; nothing is ever hard-deleted (posted history must stay intact).
 */

import { dbQuery } from "../db";

export interface CoaNode {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parent_id: string | null;
  is_group: boolean;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
  balance: number; // debit − credit of POSTED lines (group = sum of children)
  postings: number;
}

const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

export async function listChartOfAccounts(): Promise<CoaNode[]> {
  const res = await dbQuery(
    `SELECT a.id, a.code, a.name, a.type, a.subtype, a.parent_id, a.is_group, a.is_system, a.is_active, a.description,
            COALESCE(b.bal, 0)::float AS balance, COALESCE(b.n, 0)::int AS postings
       FROM public.accounting_account a
       LEFT JOIN (
         SELECT l.account_id, SUM(l.debit_amount - l.credit_amount) AS bal, COUNT(*) AS n
           FROM public.accounting_journal_line l
           JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
           JOIN public.accounting_voucher v ON v.id = e.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
          GROUP BY l.account_id
       ) b ON b.account_id = a.id
      WHERE a.deleted_at IS NULL
      ORDER BY a.code`
  );
  const nodes: CoaNode[] = res.rows.map((r: any) => ({ ...r, balance: r2(r.balance), postings: Number(r.postings) }));
  // Roll balances up to groups
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.is_group) continue;
    let p = n.parent_id ? byId.get(n.parent_id) : undefined;
    const guard = new Set<string>();
    while (p && !guard.has(p.id)) {
      guard.add(p.id);
      p.balance = r2(p.balance + n.balance);
      p.postings += n.postings;
      p = p.parent_id ? byId.get(p.parent_id) : undefined;
    }
  }
  return nodes;
}

async function nextChildCode(parent: { id: string; code: string }): Promise<string> {
  const used = new Set(
    (await dbQuery(`SELECT code FROM public.accounting_account WHERE code LIKE $1 || '%'`, [parent.code])).rows.map((r: any) => r.code)
  );
  // Group codes like 2150 get children 2151..2159 first, then 2150-01.. ; others get <code>-01..
  if (/^\d{4}$/.test(parent.code) && parent.code.endsWith("0")) {
    const base = Number(parent.code);
    for (let i = 1; i <= 9; i++) {
      const c = String(base + i);
      if (!used.has(c)) {
        const clash = await dbQuery(`SELECT 1 FROM public.accounting_account WHERE code = $1`, [c]);
        if (!clash.rows.length) return c;
      }
    }
  }
  for (let i = 1; i <= 99; i++) {
    const c = `${parent.code}-${String(i).padStart(2, "0")}`;
    if (!used.has(c)) return c;
  }
  throw new Error("No free ledger code under this group.");
}

export async function createLedger(input: { parent_id: string; name: string; description?: string; is_group?: boolean; code?: string }, createdBy: string) {
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Enter a ledger name.");
  const parent = (await dbQuery(`SELECT * FROM public.accounting_account WHERE id = $1 AND deleted_at IS NULL`, [input.parent_id])).rows[0];
  if (!parent) throw new Error("Choose the group this ledger belongs under.");
  if (!parent.is_group) throw new Error(`'${parent.code} ${parent.name}' is a ledger, not a group. Choose a group.`);
  const dup = await dbQuery(`SELECT code FROM public.accounting_account WHERE parent_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL`, [parent.id, name]);
  if (dup.rows.length) throw new Error(`A ledger named '${name}' already exists under ${parent.code} (${dup.rows[0].code}).`);
  let code = String(input.code || "").trim();
  if (code) {
    if (!/^[0-9A-Z-]{3,20}$/i.test(code)) throw new Error("Code may use digits, letters and '-' (3–20 chars).");
    if ((await dbQuery(`SELECT 1 FROM public.accounting_account WHERE code = $1`, [code])).rows.length) throw new Error(`Code ${code} is already used.`);
  } else {
    code = await nextChildCode(parent);
  }
  const id = `acc_${code.replace(/[^0-9A-Za-z]/g, "_")}_${Date.now().toString(36)}`;
  const res = await dbQuery(
    `INSERT INTO public.accounting_account (id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, $9, $10, NOW(), NOW()) RETURNING *`,
    [id, code, name.slice(0, 120), parent.type, parent.subtype, parent.id, Number(parent.level || 1) + 1, Boolean(input.is_group), String(input.description || "").slice(0, 300) || null, createdBy || "admin"]
  );
  return res.rows[0];
}

export async function updateLedger(id: string, input: { name?: string; description?: string; is_active?: boolean }) {
  const a = (await dbQuery(`SELECT * FROM public.accounting_account WHERE id = $1 AND deleted_at IS NULL`, [id])).rows[0];
  if (!a) throw new Error("Ledger not found.");
  if (a.is_system && (input.name !== undefined || input.is_active === false)) {
    throw new Error("System ledgers are used by automatic postings and can't be renamed or deactivated.");
  }
  if (input.is_active === false) {
    const node = (await listChartOfAccounts()).find((n) => n.id === id);
    if (node && Math.abs(node.balance) > 0.005) throw new Error(`This ledger has a balance of ₹${node.balance.toFixed(2)}. Clear it before deactivating.`);
    if (a.is_group) {
      const kids = await dbQuery(`SELECT 1 FROM public.accounting_account WHERE parent_id = $1 AND is_active AND deleted_at IS NULL LIMIT 1`, [id]);
      if (kids.rows.length) throw new Error("Deactivate the ledgers inside this group first.");
    }
  }
  const name = input.name !== undefined ? String(input.name).trim() : a.name;
  if (name.length < 2) throw new Error("Enter a ledger name.");
  const res = await dbQuery(
    `UPDATE public.accounting_account SET name = $2, description = $3, is_active = $4, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, name.slice(0, 120), input.description !== undefined ? String(input.description).slice(0, 300) : a.description, input.is_active !== undefined ? Boolean(input.is_active) : a.is_active]
  );
  return res.rows[0];
}
