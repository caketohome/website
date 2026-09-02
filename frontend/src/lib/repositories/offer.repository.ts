import { dbQuery } from "../db";
import { OfferDomain } from "../types/domain";

export class OfferRepository {
  /**
   * Find all active offers from PostgreSQL
   */
  static async findAll(): Promise<OfferDomain[]> {
    const res = await dbQuery(`SELECT * FROM "offer" WHERE deleted_at IS NULL ORDER BY created_at ASC`);
    return (res.rows || []).map((off: any) => {
      const meta = off.metadata || {};
      return {
        id: off.id,
        name: off.name,
        code: off.code,
        type: off.type,
        discount_type: off.type,
        discount_value: Number(off.discount_value || 0),
        min_order: Number(off.min_order || 0),
        min_order_value: Number(off.min_order || 0),
        max_discount_value: off.max_discount_value ? Number(off.max_discount_value) : null,
        is_active: off.is_active !== false,
        status: off.is_active !== false ? "active" : "inactive",
        description: off.description,
        rules: meta.rules || {},
        starts_at: off.starts_at,
        ends_at: off.ends_at,
        created_at: off.created_at,
        updated_at: off.updated_at,
      };
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
    const meta = off.metadata || {};
    return {
      id: off.id,
      name: off.name,
      code: off.code,
      type: off.type,
      discount_type: off.type,
      discount_value: Number(off.discount_value || 0),
      min_order: Number(off.min_order || 0),
      min_order_value: Number(off.min_order || 0),
      max_discount_value: off.max_discount_value ? Number(off.max_discount_value) : null,
      is_active: off.is_active !== false,
      status: off.is_active !== false ? "active" : "inactive",
      description: off.description,
      rules: meta.rules || {},
      starts_at: off.starts_at,
      ends_at: off.ends_at,
      created_at: off.created_at,
      updated_at: off.updated_at,
    };
  }

  /**
   * Save offer in PostgreSQL
   */
  static async save(offer: Partial<OfferDomain>): Promise<void> {
    const id = offer.id || `off_${Date.now()}`;
    const code = (offer.code || `OFFER_${Date.now()}`).toUpperCase().trim();
    const type = offer.type || offer.discount_type || "flat";
    const discountVal = Number(offer.discount_value || 0);
    const minOrder = Number(offer.min_order || offer.min_order_value || 0);
    const metadata = { rules: offer.rules || {} };

    await dbQuery(
      `
      INSERT INTO "offer" (id, name, code, type, discount_value, min_order, is_active, description, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        type = EXCLUDED.type,
        discount_value = EXCLUDED.discount_value,
        min_order = EXCLUDED.min_order,
        is_active = EXCLUDED.is_active,
        description = EXCLUDED.description,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [
        id,
        offer.name || `Promo ${code}`,
        code,
        type,
        discountVal,
        minOrder,
        offer.is_active !== false,
        offer.description || "",
        JSON.stringify(metadata),
      ]
    );
  }

  /**
   * Delete / archive offer
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(`UPDATE "offer" SET deleted_at = NOW(), is_active = false WHERE id = $1 OR code = $1`, [id]);
  }
}
