import { dbQuery } from "../db";
import { StateDomain } from "./city.repository";

export class StateRepository {
  /**
   * Map raw PostgreSQL "state" row to canonical StateDomain
   */
  static mapRowToDomain(row: any): StateDomain {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      gst_state_code: row.gst_state_code || "",
      country_id: row.country_id || "country_in",
      country_code: row.country_code || "IN",
      timezone: row.timezone || "Asia/Kolkata",
      currency: row.currency || "INR",
      currency_symbol: row.currency_symbol || "₹",
      status: row.is_active !== false && row.status !== "archived" ? "active" : "archived",
      display_order: Number(row.display_order) || 1,
    };
  }

  /**
   * Find all states from PostgreSQL
   */
  static async findAll(options?: { includeArchived?: boolean } | boolean): Promise<StateDomain[]> {
    const includeArchived = typeof options === "boolean" ? options : options?.includeArchived;
    const query = includeArchived
      ? `SELECT * FROM "state" WHERE deleted_at IS NULL ORDER BY display_order ASC, name ASC`
      : `SELECT * FROM "state" WHERE deleted_at IS NULL AND is_active = true AND status = 'active' ORDER BY display_order ASC, name ASC`;

    const res = await dbQuery(query);
    if (!res.rows || res.rows.length === 0) {
      // Fallback if table query returned nothing
      return [];
    }
    return res.rows.map((r: any) => StateRepository.mapRowToDomain(r));
  }

  /**
   * Find state by ID (e.g. state_ka)
   */
  static async findById(id: string): Promise<StateDomain | null> {
    const res = await dbQuery(
      `SELECT * FROM "state" WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Find state by 2-letter Code (e.g. KA, KL)
   */
  static async findByCode(code: string): Promise<StateDomain | null> {
    const clean = (code || "").trim().toUpperCase();
    const res = await dbQuery(
      `SELECT * FROM "state" WHERE (code = $1 OR gst_state_code = $1) AND deleted_at IS NULL LIMIT 1`,
      [clean]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Create a new state in PostgreSQL
   */
  static async create(payload: Partial<StateDomain>): Promise<StateDomain> {
    const code = (payload.code || "").trim().toUpperCase();
    if (!code) throw new Error("State code is required (e.g. KA, KL, TN).");
    const name = (payload.name || code).trim();

    const existing = await StateRepository.findByCode(code);
    if (existing) throw new Error(`State with code "${code}" already exists.`);

    if (!/^[A-Z]{2}$/.test(code)) throw new Error("State code must be exactly 2 letters (e.g. KA, KL).");
    const id = payload.id || `state_${code.toLowerCase()}`;
    const gstCode = (payload.gst_state_code || "").trim();
    if (gstCode && !/^\d{2}$/.test(gstCode)) throw new Error("GST state code must be exactly 2 digits (e.g. 29, 32).");
    if (gstCode) {
      const gstTaken = await dbQuery(
        `SELECT name FROM "state" WHERE gst_state_code = $1 AND deleted_at IS NULL LIMIT 1`,
        [gstCode]
      );
      if (gstTaken.rows?.length) throw new Error(`GST state code ${gstCode} already belongs to ${gstTaken.rows[0].name}.`);
    }
    const countryId = payload.country_id || "country_in";
    const countryCode = (payload.country_code || "IN").trim().toUpperCase();
    const timezone = payload.timezone || "Asia/Kolkata";
    const currency = payload.currency || "INR";
    const currencySymbol = payload.currency_symbol || "₹";
    const status = payload.status || "active";
    const isActive = status === "active";
    const displayOrder = Number(payload.display_order) || 10;

    const res = await dbQuery(
      `INSERT INTO "state" (
        "id", "code", "name", "gst_state_code", "country_id", "country_code",
        "timezone", "currency", "currency_symbol", "is_active", "status",
        "display_order", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "code" = EXCLUDED.code, "name" = EXCLUDED.name, "gst_state_code" = EXCLUDED.gst_state_code,
        "country_id" = EXCLUDED.country_id, "country_code" = EXCLUDED.country_code,
        "timezone" = EXCLUDED.timezone, "currency" = EXCLUDED.currency,
        "currency_symbol" = EXCLUDED.currency_symbol, "is_active" = EXCLUDED.is_active,
        "status" = EXCLUDED.status, "display_order" = EXCLUDED.display_order,
        "deleted_at" = NULL, "updated_at" = NOW()
      WHERE "state".deleted_at IS NOT NULL
      RETURNING *`,
      [id, code, name, gstCode, countryId, countryCode, timezone, currency, currencySymbol, isActive, status, displayOrder]
    );
    if (!res.rows?.length) throw new Error(`State id "${id}" already exists.`);

    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Update an existing state in PostgreSQL
   */
  static async update(id: string, payload: Partial<StateDomain>): Promise<StateDomain | null> {
    const existing = await StateRepository.findById(id);
    if (!existing) return null;

    const name = payload.name !== undefined ? payload.name.trim() : existing.name;
    const code = payload.code !== undefined ? payload.code.trim().toUpperCase() : existing.code;
    const gstCode = payload.gst_state_code !== undefined ? payload.gst_state_code.trim() : existing.gst_state_code;
    const countryId = payload.country_id !== undefined ? payload.country_id : existing.country_id;
    const countryCode = payload.country_code !== undefined ? payload.country_code.trim().toUpperCase() : existing.country_code;
    const timezone = payload.timezone !== undefined ? payload.timezone : existing.timezone;
    const currency = payload.currency !== undefined ? payload.currency : existing.currency;
    const currencySymbol = payload.currency_symbol !== undefined ? payload.currency_symbol : existing.currency_symbol;
    const status = payload.status !== undefined ? payload.status : existing.status;
    const isActive = status === "active";
    const displayOrder = payload.display_order !== undefined ? Number(payload.display_order) : existing.display_order;

    const res = await dbQuery(
      `UPDATE "state" SET
        "name" = $1,
        "code" = $2,
        "gst_state_code" = $3,
        "country_id" = $4,
        "country_code" = $5,
        "timezone" = $6,
        "currency" = $7,
        "currency_symbol" = $8,
        "is_active" = $9,
        "status" = $10,
        "display_order" = $11,
        "updated_at" = NOW()
      WHERE "id" = $12
      RETURNING *`,
      [name, code, gstCode, countryId, countryCode, timezone, currency, currencySymbol, isActive, status, displayOrder, id]
    );

    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Archive state (soft disable) in PostgreSQL
   */
  static async archive(id: string): Promise<StateDomain | null> {
    const res = await dbQuery(
      `UPDATE "state" SET "is_active" = false, "status" = 'archived', "updated_at" = NOW()
       WHERE "id" = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Restore archived state in PostgreSQL
   */
  static async restore(id: string): Promise<StateDomain | null> {
    const res = await dbQuery(
      `UPDATE "state" SET "is_active" = true, "status" = 'active', "updated_at" = NOW()
       WHERE "id" = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return StateRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Check state dependencies before removal
   */
  static async checkDependencies(id: string): Promise<{
    citiesCount: number;
    branchesCount: number;
    canDelete: boolean;
    stateName: string;
  }> {
    const state = await StateRepository.findById(id);
    if (!state) return { citiesCount: 0, branchesCount: 0, canDelete: true, stateName: "" };

    const citiesRes = await dbQuery(
      `SELECT COUNT(*) as count FROM "city" WHERE (state_id = $1 OR state ILIKE $2) AND deleted_at IS NULL`,
      [state.id, `%${state.name}%`]
    );
    const citiesCount = parseInt(citiesRes.rows[0]?.count || "0", 10);

    const branchesRes = await dbQuery(
      `SELECT COUNT(*) as count FROM "branch" b
       JOIN "city" c ON b.city_id = c.id
       WHERE (c.state_id = $1 OR c.state ILIKE $2) AND b.deleted_at IS NULL`,
      [state.id, `%${state.name}%`]
    );
    const branchesCount = parseInt(branchesRes.rows[0]?.count || "0", 10);

    return {
      citiesCount,
      branchesCount,
      canDelete: citiesCount === 0 && branchesCount === 0,
      stateName: state.name,
    };
  }

  /**
   * Soft delete state only if zero dependencies
   */
  static async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const deps = await StateRepository.checkDependencies(id);
    if (!deps.canDelete) {
      return {
        success: false,
        error: `Cannot delete state "${deps.stateName}". It has ${deps.citiesCount} cities and ${deps.branchesCount} branches connected. Please archive it instead.`,
      };
    }

    await dbQuery(
      `UPDATE "state" SET "deleted_at" = NOW(), "is_active" = false, "status" = 'archived' WHERE "id" = $1`,
      [id]
    );
    return { success: true };
  }
}
