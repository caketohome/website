/**
 * Feature Flag Repository
 * Relational PostgreSQL persistence for hierarchical business feature flags and audit trail.
 */

import { dbQuery } from "../db";

export interface FeatureFlagRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  scope: "GLOBAL" | "BRANCH" | "PARTNER";
  entity_id: string;
  is_enabled: boolean;
  is_system_mandatory: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagAuditRow {
  id: string;
  flag_id: string;
  key: string;
  scope: string;
  entity_id: string;
  previous_value: boolean | null;
  new_value: boolean;
  actor_id: string;
  actor_role: string;
  reason: string | null;
  created_at: string;
}

export class FeatureFlagRepository {
  /**
   * List all feature flags, optionally filtered by scope or category
   */
  static async list(filters: {
    scope?: string;
    entityId?: string;
    category?: string;
  } = {}): Promise<FeatureFlagRow[]> {
    const params: any[] = [];
    let sql = `
      SELECT id, key, name, description, category, scope, entity_id, is_enabled, is_system_mandatory, metadata, created_at, updated_at
      FROM "feature_flag"
      WHERE 1=1
    `;

    if (filters.scope) {
      params.push(filters.scope.toUpperCase());
      sql += ` AND scope = $${params.length}`;
    }
    if (filters.entityId) {
      params.push(filters.entityId);
      sql += ` AND entity_id = $${params.length}`;
    }
    if (filters.category) {
      params.push(filters.category.toUpperCase());
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY key ASC, scope ASC`;
    const res = await dbQuery(sql, params);
    return res.rows || [];
  }

  /**
   * Find specific flag definition by key and scope
   */
  static async find(key: string, scope: string = "GLOBAL", entityId: string = "global"): Promise<FeatureFlagRow | null> {
    const res = await dbQuery(`
      SELECT id, key, name, description, category, scope, entity_id, is_enabled, is_system_mandatory, metadata, created_at, updated_at
      FROM "feature_flag"
      WHERE key = $1 AND scope = $2 AND entity_id = $3
      LIMIT 1;
    `, [key.toUpperCase(), scope.toUpperCase(), entityId]);

    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Resolve effective flag value applying inheritance:
   * 1. Global flag
   * 2. If entity override exists (BRANCH or PARTNER) and global flag is not system_mandatory, use entity override
   */
  static async resolveEffective(key: string, scope?: "BRANCH" | "PARTNER", entityId?: string): Promise<{
    key: string;
    isEnabled: boolean;
    effectiveScope: "GLOBAL" | "BRANCH" | "PARTNER";
    isMandatory: boolean;
    details: FeatureFlagRow | null;
  }> {
    const cleanKey = key.toUpperCase();
    const globalFlag = await this.find(cleanKey, "GLOBAL", "global");

    if (!globalFlag) {
      return {
        key: cleanKey,
        isEnabled: false,
        effectiveScope: "GLOBAL",
        isMandatory: false,
        details: null,
      };
    }

    // If global flag is mandatory, lower-level cannot override
    if (globalFlag.is_system_mandatory) {
      return {
        key: cleanKey,
        isEnabled: globalFlag.is_enabled,
        effectiveScope: "GLOBAL",
        isMandatory: true,
        details: globalFlag,
      };
    }

    // Check entity override if requested
    if (scope && entityId && entityId !== "global") {
      const override = await this.find(cleanKey, scope, entityId);
      if (override) {
        return {
          key: cleanKey,
          isEnabled: override.is_enabled,
          effectiveScope: scope,
          isMandatory: false,
          details: override,
        };
      }
    }

    return {
      key: cleanKey,
      isEnabled: globalFlag.is_enabled,
      effectiveScope: "GLOBAL",
      isMandatory: false,
      details: globalFlag,
    };
  }

  /**
   * Set or update feature flag and record audit entry
   */
  static async setFlag(params: {
    key: string;
    scope: "GLOBAL" | "BRANCH" | "PARTNER";
    entityId?: string;
    isEnabled: boolean;
    name?: string;
    description?: string;
    category?: string;
    isSystemMandatory?: boolean;
    actorId: string;
    actorRole: string;
    reason?: string;
  }): Promise<FeatureFlagRow> {
    const key = params.key.toUpperCase();
    const scope = params.scope.toUpperCase() as "GLOBAL" | "BRANCH" | "PARTNER";
    const entityId = params.entityId || "global";
    const flagId = `ff_${key.toLowerCase()}_${scope.toLowerCase()}_${entityId.toLowerCase()}`;

    // Get previous value
    const existing = await this.find(key, scope, entityId);
    const prevVal = existing ? existing.is_enabled : null;

    // Check if global flag is mandatory and prevents lower-level override
    if (scope !== "GLOBAL") {
      const globalFlag = await this.find(key, "GLOBAL", "global");
      if (globalFlag && globalFlag.is_system_mandatory) {
        throw new Error(`CANNOT_OVERRIDE_MANDATORY_FLAG: Feature '${key}' is locked globally for system integrity.`);
      }
    }

    const name = params.name || existing?.name || key.replace(/_/g, " ");
    const category = params.category || existing?.category || "OPERATIONS";
    const isMandatory = params.isSystemMandatory !== undefined ? params.isSystemMandatory : (existing?.is_system_mandatory || false);

    const res = await dbQuery(`
      INSERT INTO "feature_flag" (
        id, key, name, description, category, scope, entity_id, is_enabled, is_system_mandatory, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (key, scope, entity_id) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        name = EXCLUDED.name,
        description = COALESCE(EXCLUDED.description, feature_flag.description),
        is_system_mandatory = EXCLUDED.is_system_mandatory,
        updated_at = NOW()
      RETURNING *;
    `, [
      flagId,
      key,
      name,
      params.description || existing?.description || null,
      category,
      scope,
      entityId,
      params.isEnabled,
      isMandatory,
    ]);

    // Record audit
    const auditId = `ffa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await dbQuery(`
      INSERT INTO "feature_flag_audit" (
        id, flag_id, key, scope, entity_id, previous_value, new_value, actor_id, actor_role, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());
    `, [
      auditId,
      flagId,
      key,
      scope,
      entityId,
      prevVal,
      params.isEnabled,
      params.actorId,
      params.actorRole,
      params.reason || `Flag updated by ${params.actorRole}`,
    ]);

    return res.rows[0];
  }

  /**
   * Get audit log for key
   */
  static async getAuditLog(key?: string, limit: number = 50): Promise<FeatureFlagAuditRow[]> {
    let sql = `
      SELECT id, flag_id, key, scope, entity_id, previous_value, new_value, actor_id, actor_role, reason, created_at
      FROM "feature_flag_audit"
    `;
    const params: any[] = [];
    if (key) {
      params.push(key.toUpperCase());
      sql += ` WHERE key = $1`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1};`;
    params.push(Math.min(limit, 200));

    const res = await dbQuery(sql, params);
    return res.rows || [];
  }
}
