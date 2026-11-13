/**
 * CakeToHome — Supabase Server-Side Authentication & RBAC Engine
 * 
 * Verifies Supabase JWTs, resolves authoritative database profiles, and enforces
 * branch-scoped role-based access control. Never trusts client-supplied roles.
 */

import { jwtVerify } from "jose";
import { dbQuery } from "../db";
import { AuthUserPayload } from "../security/auth-session";

export interface DatabaseUserProfile {
  id: string;
  phone: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string;
  is_profile_completed: boolean;
  roles: string[];
  primary_role: string;
  branch_ids: string[];
  company_ids: string[];
}

function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Resolves an authenticated user's profile and roles directly from the authoritative database.
 * Replaces unverified token claims with fresh PostgreSQL records.
 */
export async function getAuthoritativeUserFromDb(userId: string): Promise<DatabaseUserProfile | null> {
  if (!userId) return null;

  try {
    // 1. Fetch profile
    const profileRes = await dbQuery<any>(
      `SELECT id, phone, full_name, display_name, email, avatar_url, status, is_profile_completed
       FROM public.profiles
       WHERE id = $1 AND status != 'SUSPENDED';`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return null;
    }

    const profile = profileRes.rows[0];

    // 2. Fetch assigned roles
    const rolesRes = await dbQuery<{ role_id: string }>(
      `SELECT role_id FROM public.user_role_assignments WHERE user_id = $1;`,
      [userId]
    );
    const roles = rolesRes.rows.map((r) => r.role_id);
    if (roles.length === 0) {
      roles.push("CUSTOMER");
    }

    // Determine highest-precedence role
    const precedence = [
      "SUPER_ADMIN",
      "ADMIN",
      "FINANCE",
      "OPERATIONS",
      "STORE_MANAGER",
      "STORE_STAFF",
      "DELIVERY_PARTNER",
      "CUSTOMER",
    ];
    let primaryRole = "CUSTOMER";
    for (const p of precedence) {
      if (roles.includes(p)) {
        primaryRole = p;
        break;
      }
    }

    // 3. Fetch branch memberships
    const branchRes = await dbQuery<{ branch_id: string }>(
      `SELECT branch_id FROM public.user_branch_memberships WHERE user_id = $1;`,
      [userId]
    );
    const branch_ids = branchRes.rows.map((b) => b.branch_id);

    // 4. Fetch company memberships
    const compRes = await dbQuery<{ company_id: string }>(
      `SELECT company_id FROM public.user_company_memberships WHERE user_id = $1;`,
      [userId]
    );
    const company_ids = compRes.rows.map((c) => c.company_id);

    return {
      id: profile.id,
      phone: profile.phone,
      full_name: profile.full_name,
      display_name: profile.display_name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      status: profile.status,
      is_profile_completed: profile.is_profile_completed,
      roles,
      primary_role: primaryRole,
      branch_ids,
      company_ids,
    };
  } catch (err: any) {
    console.error("[Auth] Database user resolution error:", err.message);
    return null;
  }
}

/**
 * Cryptographically verifies a Supabase or CakeToHome JWT using jose
 */
export async function verifySupabaseToken(token: string): Promise<AuthUserPayload | null> {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleanToken) return null;

  try {
    const secretBytes = getJwtSecretBytes();
    const { payload } = await jwtVerify(cleanToken, secretBytes, {
      algorithms: ["HS256"],
    });

    const userId = (payload.sub || payload.userId || payload.actor_id) as string;
    if (!userId) return null;

    // Fast-path role fallback from token claims
    const tokenRole = ((payload.role as string) || "CUSTOMER").toUpperCase();

    // In production, attempt authoritative database resolution
    const dbUser = await getAuthoritativeUserFromDb(userId);
    const authoritativeRole = dbUser?.primary_role || (tokenRole === "AUTHENTICATED" ? "CUSTOMER" : tokenRole);

    return {
      userId,
      role: authoritativeRole,
      phone: dbUser?.phone || (payload.phone as string) || "",
      customerUid: `cth_cus_${(dbUser?.phone || (payload.phone as string) || "").replace(/\D/g, "").slice(-10)}`,
      customerId: userId,
      branchId: dbUser?.branch_ids[0] || (payload.branchId as string) || null,
      partnerId: (payload.partnerId as string) || null,
      name: dbUser?.display_name || (payload.name as string) || "",
      email: dbUser?.email || (payload.email as string) || "",
      isSuperAdmin: authoritativeRole === "SUPER_ADMIN",
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Server authorization guard enforcing required role
 */
export function authorizeRoles(user: AuthUserPayload | null, allowedRoles: string[]): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.isSuperAdmin) return true;
  return allowedRoles.map((r) => r.toUpperCase()).includes(user.role.toUpperCase());
}

/**
 * Server authorization guard enforcing branch-level scoping
 */
export function authorizeBranch(user: AuthUserPayload | null, targetBranchId: string): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.isSuperAdmin || user.role === "ADMIN") return true;
  if (!targetBranchId) return false;
  return user.branchId === targetBranchId;
}
