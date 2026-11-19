/**
 * Organisation defaults read from Supabase (never hardcoded IDs).
 *
 * - Head-office branch: the live branch marked metadata.is_head_office = true,
 *   otherwise the oldest live branch. Used only for company-level entries that
 *   have no branch of their own (e.g. a transfer between company bank accounts).
 * - Company id: the active company record.
 */
import { dbQuery } from "./db";

type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[] }>;
type Queryable = QueryFn | { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> };

const run = (q: Queryable | undefined, text: string, params?: any[]) =>
  !q ? dbQuery(text, params) : typeof q === "function" ? q(text, params) : q.query(text, params);

export async function resolveHeadOfficeBranchId(q?: Queryable): Promise<string> {
  const r = await run(
    q,
    `SELECT id FROM public.branch
      WHERE deleted_at IS NULL
      ORDER BY (metadata->>'is_head_office') = 'true' DESC NULLS LAST, created_at ASC
      LIMIT 1`
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("NO_BRANCH: Add a branch before recording this entry.");
  return id;
}

export async function resolveCompanyId(q?: Queryable): Promise<string> {
  const r = await run(
    q,
    `SELECT id FROM public.company
      ORDER BY (COALESCE(is_active, true)) DESC, created_at ASC
      LIMIT 1`
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("NO_COMPANY: Set up the company in Settings → Business Profile first.");
  return id;
}
