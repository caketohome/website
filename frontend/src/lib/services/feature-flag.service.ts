/**
 * Feature Flag Domain Service
 * Enforces server-side authorization, scope boundaries, safety restrictions, and auditability.
 */

import { FeatureFlagRepository, FeatureFlagRow, FeatureFlagAuditRow } from "../repositories/feature-flag.repository";

export interface AuthenticatedActor {
  userId: string;
  role?: string;
  branchId?: string | null;
  partnerId?: string | null;
  permissions?: string[];
}

export class FeatureFlagService {
  /**
   * Determine if a feature is enabled in a specific context
   */
  static async isEnabled(
    key: string,
    context?: { scope?: "BRANCH" | "PARTNER"; entityId?: string }
  ): Promise<boolean> {
    const res = await FeatureFlagRepository.resolveEffective(key, context?.scope, context?.entityId);
    return res.isEnabled;
  }

  /**
   * Get all effective feature flags for an actor or entity
   */
  static async getAllEffective(context?: { scope?: "BRANCH" | "PARTNER"; entityId?: string }): Promise<Record<string, boolean>> {
    const allFlags = await FeatureFlagRepository.list();
    const uniqueKeys = Array.from(new Set(allFlags.map(f => f.key)));
    const map: Record<string, boolean> = {};

    for (const key of uniqueKeys) {
      const eff = await FeatureFlagRepository.resolveEffective(key, context?.scope, context?.entityId);
      map[key] = eff.isEnabled;
    }
    return map;
  }

  /**
   * List all feature flag records
   */
  static async listFlags(filters: any = {}): Promise<FeatureFlagRow[]> {
    return FeatureFlagRepository.list(filters);
  }

  /**
   * Set or update feature flag with strict authorization
   */
  static async setFlag(
    input: {
      key: string;
      scope: "GLOBAL" | "BRANCH" | "PARTNER";
      entityId?: string;
      isEnabled: boolean;
      name?: string;
      description?: string;
      category?: string;
      isSystemMandatory?: boolean;
      reason?: string;
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; flag?: FeatureFlagRow; error?: string }> {
    // 1. Authorization checks
    const targetScope = input.scope.toUpperCase() as "GLOBAL" | "BRANCH" | "PARTNER";
    const targetEntityId = input.entityId || "global";
    const actorRole = (actor.role || "").toUpperCase();

    if (targetScope === "GLOBAL") {
      if (actorRole !== "SUPER_ADMIN") {
        return { success: false, error: "UNAUTHORIZED: Only Super Admin can change global feature flags." };
      }
    } else if (targetScope === "BRANCH") {
      const isSuper = actorRole === "SUPER_ADMIN" || actorRole === "ADMIN";
      const isBranchMgr = actorRole === "BRANCH_MANAGER" && actor.branchId === targetEntityId;
      if (!isSuper && !isBranchMgr) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to modify feature flags for this branch." };
      }
    } else if (targetScope === "PARTNER") {
      const isSuper = actorRole === "SUPER_ADMIN";
      const isPartnerAdmin = (actorRole === "PARTNER_ADMIN" || actorRole === "PARTNER_OWNER") && actor.partnerId === targetEntityId;
      if (!isSuper && !isPartnerAdmin) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to modify feature flags for this marketplace partner." };
      }
    }

    try {
      const flag = await FeatureFlagRepository.setFlag({
        key: input.key,
        scope: targetScope,
        entityId: targetEntityId,
        isEnabled: input.isEnabled,
        name: input.name,
        description: input.description,
        category: input.category,
        isSystemMandatory: input.isSystemMandatory,
        actorId: actor.userId,
        actorRole: actor.role || "ADMIN",
        reason: input.reason,
      });

      return { success: true, flag };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get audit history for feature flags
   */
  static async getAuditLog(key?: string, limit: number = 50): Promise<FeatureFlagAuditRow[]> {
    return FeatureFlagRepository.getAuditLog(key, limit);
  }
}
