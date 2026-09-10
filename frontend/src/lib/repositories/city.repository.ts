import { dbQuery } from "../db";

export interface StateDomain {
  id: string;
  code: string;
  name: string;
  gst_state_code: string;
  country_id: string;
  country_code: string;
  timezone: string;
  currency: string;
  currency_symbol: string;
  status: "active" | "archived";
  display_order: number;
}

export interface CityDomain {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_id: string;
  state_code: string;
  stateCode?: string;
  gst_state_code?: string;
  country: string;
  countryCode: string;
  timezone: string;
  currency: string;
  phoneCode: string;
  status: "active" | "archived";
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const CANONICAL_STATES: StateDomain[] = [
  { id: "state_ka", code: "KA", gst_state_code: "29", name: "Karnataka", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 1 },
  { id: "state_kl", code: "KL", gst_state_code: "32", name: "Kerala", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 2 },
  { id: "state_tn", code: "TN", gst_state_code: "33", name: "Tamil Nadu", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 3 },
  { id: "state_mh", code: "MH", gst_state_code: "27", name: "Maharashtra", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 4 },
  { id: "state_dl", code: "DL", gst_state_code: "07", name: "Delhi NCR", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 5 },
  { id: "state_tg", code: "TG", gst_state_code: "36", name: "Telangana", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 6 },
  { id: "state_ap", code: "AP", gst_state_code: "37", name: "Andhra Pradesh", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 7 },
  { id: "state_gj", code: "GJ", gst_state_code: "24", name: "Gujarat", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 8 },
  { id: "state_wb", code: "WB", gst_state_code: "19", name: "West Bengal", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 9 },
  { id: "state_rj", code: "RJ", gst_state_code: "08", name: "Rajasthan", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 10 },
];

export function resolveStateInfo(stateNameOrCodeOrId?: string | null): StateDomain | null {
  if (!stateNameOrCodeOrId) return null;
  const clean = stateNameOrCodeOrId.trim().toLowerCase();
  return CANONICAL_STATES.find(
    (s) =>
      s.id.toLowerCase() === clean ||
      s.code.toLowerCase() === clean ||
      s.name.toLowerCase() === clean ||
      clean.startsWith(s.name.toLowerCase()) ||
      s.name.toLowerCase().startsWith(clean)
  ) || null;
}

export class CityRepository {
  /**
   * Map raw PostgreSQL "city" row into a canonical CityDomain object
   */
  static mapRowToDomain(row: any): CityDomain {
    const rawState = row.state || "";
    const matchedState = resolveStateInfo(rawState);
    const stateId = matchedState?.id || `state_${rawState.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 2)}`;
    const stateCode = matchedState?.code || rawState.slice(0, 2).toUpperCase();
    const gstCode = matchedState?.gst_state_code || "";

    const isActive = row.is_active !== false;
    return {
      id: row.id,
      name: row.name,
      slug: row.id.replace(/^city_/, ""),
      state: matchedState?.name || rawState,
      state_id: stateId,
      state_code: stateCode,
      stateCode: stateCode,
      gst_state_code: gstCode,
      country: "India",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      phoneCode: "+91",
      status: isActive ? "active" : "archived",
      is_active: isActive,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  /**
   * Find all active cities directly from PostgreSQL
   */
  static async findAll(options?: { includeArchived?: boolean } | boolean): Promise<CityDomain[]> {
    const includeArchived = typeof options === "boolean" ? options : options?.includeArchived;
    const query = includeArchived
      ? `SELECT id, name, state, is_active, created_at, updated_at FROM "city" WHERE deleted_at IS NULL ORDER BY name ASC`
      : `SELECT id, name, state, is_active, created_at, updated_at FROM "city" WHERE deleted_at IS NULL AND is_active = true ORDER BY name ASC`;

    const res = await dbQuery(query);
    return (res.rows || []).map((r: any) => CityRepository.mapRowToDomain(r));
  }

  /**
   * Find city by canonical ID
   */
  static async findById(id: string): Promise<CityDomain | null> {
    const res = await dbQuery(
      `SELECT id, name, state, is_active, created_at, updated_at FROM "city" WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return CityRepository.mapRowToDomain(res.rows[0]);
  }

  /**
   * Find cities belonging to a state (by state ID, state code, or state name)
   */
  static async findByState(stateIdOrCodeOrName: string, options?: { includeArchived?: boolean }): Promise<CityDomain[]> {
    const matchedState = resolveStateInfo(stateIdOrCodeOrName);
    const searchName = matchedState ? matchedState.name : stateIdOrCodeOrName.trim();

    const query = options?.includeArchived
      ? `SELECT id, name, state, is_active, created_at, updated_at FROM "city" WHERE deleted_at IS NULL AND state ILIKE $1 ORDER BY name ASC`
      : `SELECT id, name, state, is_active, created_at, updated_at FROM "city" WHERE deleted_at IS NULL AND is_active = true AND state ILIKE $1 ORDER BY name ASC`;

    const res = await dbQuery(query, [`%${searchName}%`]);
    return (res.rows || []).map((r: any) => CityRepository.mapRowToDomain(r));
  }

  /**
   * Return canonical statutory states list
   */
  static listStates(includeArchived?: boolean): StateDomain[] {
    if (includeArchived) return CANONICAL_STATES;
    return CANONICAL_STATES.filter((s) => s.status === "active");
  }

  /**
   * Validate server-side that a city belongs to a state
   */
  static async validateCityBelongsToState(
    cityId: string,
    stateIdOrCodeOrName: string
  ): Promise<{ valid: boolean; city?: CityDomain; error?: string }> {
    if (!cityId) {
      return { valid: false, error: "City ID is required." };
    }
    if (!stateIdOrCodeOrName) {
      return { valid: false, error: "State identifier is required." };
    }

    const city = await CityRepository.findById(cityId);
    if (!city) {
      return { valid: false, error: `City "${cityId}" does not exist in the database.` };
    }

    const matchedState = resolveStateInfo(stateIdOrCodeOrName);
    const expectedStateName = matchedState ? matchedState.name.toLowerCase() : stateIdOrCodeOrName.trim().toLowerCase();
    const cityStateName = (city.state || "").trim().toLowerCase();

    if (cityStateName !== expectedStateName && !cityStateName.includes(expectedStateName) && !expectedStateName.includes(cityStateName)) {
      return {
        valid: false,
        city,
        error: `City "${city.name}" (${city.state}) does not belong to the selected state "${matchedState?.name || stateIdOrCodeOrName}".`,
      };
    }

    return { valid: true, city };
  }
}
