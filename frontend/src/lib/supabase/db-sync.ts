/**
 * CakeToHome — Supabase Database Synchronization Service
 * 
 * Synchronizes authenticated users into authoritative PostgreSQL tables:
 * - auth.users
 * - public.profiles
 * - public.user_role_assignments
 * - public.user_branch_memberships
 * - public.auth_audit_events
 */

import { dbQuery } from "../db";

export interface SyncAuthUserParams {
  phone: string;
  role: string;
  name?: string;
  email?: string;
  branchId?: string | null;
  partnerId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  eventType?: string;
}

export async function syncAuthUserToDatabase(params: SyncAuthUserParams): Promise<{
  userId: string;
  role: string;
  profile: any;
}> {
  const cleanPhone = params.phone.replace(/\D/g, "").slice(-10);
  const e164Phone = `+91${cleanPhone}`;
  const targetRole = (params.role || "CUSTOMER").toUpperCase();

  try {
    // 1. Ensure user exists in auth.users
    const userRes = await dbQuery(
      `INSERT INTO auth.users (phone, email, raw_user_meta_data)
       VALUES ($1, $2, jsonb_build_object('name', $3, 'phone', $1))
       ON CONFLICT (phone) DO UPDATE SET
         last_sign_in_at = now(),
         updated_at = now()
       RETURNING id, phone;`,
      [e164Phone, params.email || null, params.name || 'Customer']
    );

    const userId = userRes.rows[0].id;

    // 2. Ensure profile exists in public.profiles
    await dbQuery(
      `INSERT INTO public.profiles (id, phone, full_name, display_name, email, status, last_activity_at)
       VALUES ($1, $2, $3, $3, $4, 'ACTIVE', now())
       ON CONFLICT (id) DO UPDATE SET
         full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
         display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
         email = COALESCE(EXCLUDED.email, public.profiles.email),
         last_activity_at = now();`,
      [userId, e164Phone, params.name || 'Customer', params.email || null]
    );

    // 3. Ensure role exists in public.user_role_assignments
    await dbQuery(
      `INSERT INTO public.user_role_assignments (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING;`,
      [userId, targetRole]
    );

    // 4. Branch membership if branchId is provided
    if (params.branchId) {
      await dbQuery(
        `INSERT INTO public.user_branch_memberships (user_id, branch_id, is_primary)
         VALUES ($1, $2, true)
         ON CONFLICT (user_id, branch_id) DO NOTHING;`,
        [userId, params.branchId]
      );
    }

    // 5. Audit event
    await dbQuery(
      `INSERT INTO public.auth_audit_events (user_id, phone, event_type, ip_address, user_agent, status, metadata)
       VALUES ($1, $2, $3, $4, $5, 'SUCCESS', jsonb_build_object('role', $6));`,
      [
        userId,
        e164Phone,
        params.eventType || 'LOGIN_SUCCESS',
        params.ipAddress || '127.0.0.1',
        params.userAgent || 'Web-Browser',
        targetRole,
      ]
    );

    return {
      userId,
      role: targetRole,
      profile: {
        id: userId,
        phone: e164Phone,
        name: params.name || 'Customer',
        email: params.email || null,
        role: targetRole,
      },
    };
  } catch (err: any) {
    console.warn('[DB-SYNC] Fallback to in-memory profile sync:', err.message);
    return {
      userId: `usr_${cleanPhone}`,
      role: targetRole,
      profile: {
        id: `usr_${cleanPhone}`,
        phone: e164Phone,
        role: targetRole,
      },
    };
  }
}
