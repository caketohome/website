import { dbQuery } from "../db";
import { OfferDomain } from "../types/domain";
import { persistOfferToDb, deleteOfferFromDb } from "../db-persistence";

export class OfferRepository {
  /**
   * Find all active offers from PostgreSQL
   */
  static async findAll(): Promise<OfferDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "offer" WHERE deleted_at IS NULL ORDER BY created_at ASC`
    );
    return (res.rows || []).map((off: any) => {
      const meta = typeof off.metadata === "string" ? (() => { try { return JSON.parse(off.metadata); } catch { return {}; } })() : (off.metadata || {});
      const discountVal = Number(meta.discount_value ?? off.discount_value ?? 0);
      const minOrderVal = Number(off.min_order_value ?? off.min_order ?? 0);
      const isActive = off.status === "active";

      return {
        id: off.id,
        name: off.name,
        code: off.code,
        type: off.type,
        discount_type: off.type,
        discount_value: discountVal,
        min_order: minOrderVal,
        min_order_value: minOrderVal,
        max_discount_value: off.max_discount_value ? Number(off.max_discount_value) : null,
        is_active: isActive,
        status: off.status || "active",
        description: off.description,
        rules: meta.rules || {},
        starts_at: off.starts_at,
        ends_at: off.ends_at,
        created_at: off.created_at,
        updated_at: off.updated_at,
        // Enterprise columns preserved
        applicable_categories: off.applicable_categories,
        applicable_products: off.applicable_products,
        never_expires: off.never_expires,
        usage_limit: off.usage_limit,
        per_customer_limit: off.per_customer_limit,
      } as any;
    });
  }

  /**
   * Find offer by code
   */
  static async findByCode(code: string): Promise<OfferDomain | null> {
    const res = await dbQuery(
      `SELECT * FROM "offer" WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`,
      [code.trim()]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const off = res.rows[0];
    const meta = typeof off.metadata === "string" ? (() => { try { return JSON.parse(off.metadata); } catch { return {}; } })() : (off.metadata || {});
    const discountVal = Number(meta.discount_value ?? off.discount_value ?? 0);
    const minOrderVal = Number(off.min_order_value ?? off.min_order ?? 0);
    const isActive = off.status === "active";

    return {
      id: off.id,
      name: off.name,
      code: off.code,
      type: off.type,
      discount_type: off.type,
      discount_value: discountVal,
      min_order: minOrderVal,
      min_order_value: minOrderVal,
      max_discount_value: off.max_discount_value ? Number(off.max_discount_value) : null,
      is_active: isActive,
      status: off.status || "active",
      description: off.description,
      rules: meta.rules || {},
      starts_at: off.starts_at,
      ends_at: off.ends_at,
      created_at: off.created_at,
      updated_at: off.updated_at,
      applicable_categories: off.applicable_categories,
      applicable_products: off.applicable_products,
      never_expires: off.never_expires,
      usage_limit: off.usage_limit,
      per_customer_limit: off.per_customer_limit,
    } as any;
  }

  /**
   * Save offer in PostgreSQL (delegates to canonical persistOfferToDb to eliminate duplicate DML)
   */
  static async save(offer: Partial<OfferDomain> & Record<string, any>): Promise<void> {
    await persistOfferToDb(offer);
  }

  /**
   * Delete / archive offer (delegates to canonical deleteOfferFromDb)
   */
  static async delete(id: string): Promise<void> {
    await deleteOfferFromDb(id);
  }
}
