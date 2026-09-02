import { dbQuery } from "../db";

export class SettingRepository {
  /**
   * Find setting by key and group
   */
  static async findByKey(group: string, key: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT * FROM "setting" WHERE "group" = $1 AND "key" = $2 AND deleted_at IS NULL LIMIT 1`,
      [group, key]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const s = res.rows[0];
    if (s.is_json || typeof s.value === "string") {
      try {
        return JSON.parse(s.value);
      } catch {
        return s.value;
      }
    }
    return s.value;
  }

  /**
   * Save setting in PostgreSQL
   */
  static async save(group: string, key: string, value: any): Promise<void> {
    const id = `set_${group}_${key}`;
    const strVal = typeof value === "string" ? value : JSON.stringify(value);
    const isJson = typeof value === "object" && value !== null;

    await dbQuery(
      `
      INSERT INTO "setting" (id, "group", "key", value, is_json, is_secret, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        value = EXCLUDED.value,
        is_json = EXCLUDED.is_json,
        updated_at = NOW()
    `,
      [id, group, key, strVal, isJson, false]
    );
  }
}
