/**
 * CakeToHome ERP — Expense Category Repository
 * Phase 2: Database access for the configurable expense_category table.
 *
 * ARCHITECTURE:
 * - Uses canonical dbQuery helper from lib/db
 * - Soft deletion only — existing expenses retain their category_id (nullable FK)
 * - No SQL in services — all SQL here
 */

import { dbQuery } from "../db";
import type {
  ExpenseCategoryRow,
  ExpenseCategoryCreateInput,
  ExpenseCategoryUpdateInput,
} from "../types/expense.types";

function generateCategoryId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `excat_${ts}${rnd}`;
}

export class ExpenseCategoryRepository {
  /** Create a new expense category. */
  static async create(
    input: ExpenseCategoryCreateInput,
    createdBy: string
  ): Promise<ExpenseCategoryRow> {
    const id = generateCategoryId();
    const sql = `
      INSERT INTO public.expense_category
        (id, name, description, is_active, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      RETURNING *
    `;
    const result = await dbQuery<ExpenseCategoryRow>(sql, [
      id,
      input.name.trim(),
      input.description ?? null,
      input.is_active !== false,
      createdBy,
    ]);
    return result.rows[0];
  }

  /** Update an existing category (partial). */
  static async update(
    id: string,
    input: ExpenseCategoryUpdateInput
  ): Promise<ExpenseCategoryRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (input.name !== undefined)        addField("name",        input.name.trim());
    if (input.description !== undefined) addField("description", input.description ?? null);
    if (input.is_active !== undefined)   addField("is_active",   input.is_active);

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = NOW()");
    params.push(id);

    const sql = `
      UPDATE public.expense_category SET ${sets.join(", ")}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await dbQuery<ExpenseCategoryRow>(sql, params as any[]);
    return result.rows[0] ?? null;
  }

  /** Soft-delete a category. Existing expenses retain foreign key (nullable ON DELETE SET NULL). */
  static async softDelete(id: string): Promise<{ success: boolean; reason?: string }> {
    const existing = await dbQuery<{ count: string }>(
      "SELECT COUNT(*) FROM public.expense WHERE category_id = $1 AND status NOT IN ('POSTED') AND deleted_at IS NULL",
      [id]
    );
    if (parseInt(existing.rows[0]?.count ?? "0") > 0) {
      return {
        success: false,
        reason: "Category has active expenses. Post or remove them first.",
      };
    }
    await dbQuery(
      "UPDATE public.expense_category SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return { success: true };
  }

  /** Find category by ID. */
  static async findById(id: string): Promise<ExpenseCategoryRow | null> {
    const result = await dbQuery<ExpenseCategoryRow>(
      "SELECT * FROM public.expense_category WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return result.rows[0] ?? null;
  }

  /** List all active categories. */
  static async list(
    includeInactive = false
  ): Promise<ExpenseCategoryRow[]> {
    const where = includeInactive
      ? "deleted_at IS NULL"
      : "deleted_at IS NULL AND is_active = TRUE";
    const result = await dbQuery<ExpenseCategoryRow>(
      `SELECT * FROM public.expense_category WHERE ${where} ORDER BY name ASC`
    );
    return result.rows;
  }
}
