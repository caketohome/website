/**
 * CakeToHome Security — Authoritative Authentication & Session Verification Engine
 *
 * Implements server-side cryptographic JWT verification and tamper-proof session resolution.
 * Replaces unverified client-controlled headers and cookies with authoritative server claims.
 */

import crypto from "crypto";
import { NextRequest } from "next/server";

export interface AuthUserPayload {
  userId: string;
  role: string;
  phone?: string;
  customerUid?: string;
  customerId?: string;
  branchId?: string | null;
  partnerId?: string | null;
  name?: string;
  email?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  exp?: number;
  iat?: number;
}

// Global server-side active session store (memory fallback bridge across processes & tests)
declare global {
  // eslint-disable-next-line no-var
  var __cth_active_sessions__: Map<string, { payload: AuthUserPayload; expiresAt: number }> | undefined;
}

function getSessionRegistry(): Map<string, { payload: AuthUserPayload; expiresAt: number }> {
  if (!globalThis.__cth_active_sessions__) {
    globalThis.__cth_active_sessions__ = new Map();
  }
  return globalThis.__cth_active_sessions__;
}

/**
 * Registers an active server session token in memory.
 */
export function registerServerSession(token: string, payload: AuthUserPayload, ttlSeconds: number = 30 * 86400): void {
  if (!token) return;
  const registry = getSessionRegistry();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  registry.set(token, {
    payload: {
      ...payload,
      isSuperAdmin: payload.role === "SUPER_ADMIN" || payload.userId === "admin_01",
    },
    expiresAt,
  });
}

/**
 * Retrieves a registered active server session.
 */
export function getActiveServerSession(token: string): AuthUserPayload | null {
  if (!token) return null;
  const registry = getSessionRegistry();
  const entry = registry.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    registry.delete(token);
    return null;
  }
  return entry.payload;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
    }
    return "supersecret"; // Development and local test fallback only
  }
  return secret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

/**
 * Signs an authoritative HS256 JWT containing user identity and role claims.
 */
export function signAuthToken(payload: Partial<AuthUserPayload>, expiresInSeconds: number = 7 * 86400): string {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: AuthUserPayload = {
    userId: payload.userId || "anonymous",
    role: (payload.role || "CUSTOMER").toUpperCase(),
    phone: payload.phone || "",
    customerUid: payload.customerUid || (payload.userId?.startsWith("cth_cus_") ? payload.userId : undefined),
    customerId: payload.customerId || payload.userId,
    branchId: payload.branchId || null,
    partnerId: payload.partnerId || null,
    name: payload.name || "",
    email: payload.email || "",
    permissions: Array.isArray(payload.permissions) ? payload.permissions : undefined,
    isSuperAdmin: payload.role === "SUPER_ADMIN" || payload.userId === "admin_01",
    iat: now,
    exp,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;

  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const token = `${data}.${signature}`;

  // Also register in memory session registry for instant fast-path resolution
  registerServerSession(token, fullPayload, expiresInSeconds);

  return token;
}

/**
 * Cryptographically verifies an auth token against JWT_SECRET and expiration.
 * Also checks the server session registry.
 */
export function verifyAuthToken(token: string | null | undefined): AuthUserPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleanToken) return null;

  // 1. Fast path: check server active session store
  const activeSession = getActiveServerSession(cleanToken);
  if (activeSession) {
    return activeSession;
  }

  // 2. Cryptographic verification of standard 3-part JWT
  const parts = cleanToken.split(".");
  if (parts.length === 3) {
    const [headerB64, payloadB64, signatureB64] = parts;
    try {
      const secret = getJwtSecret();
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");

      const sigBuf = Buffer.from(signatureB64, "base64url");
      const expBuf = Buffer.from(expectedSig, "base64url");

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }

      const decodedPayload = JSON.parse(base64UrlDecode(payloadB64));
      const now = Math.floor(Date.now() / 1000);

      if (decodedPayload.exp && typeof decodedPayload.exp === "number" && now > decodedPayload.exp) {
        return null; // Expired
      }

      const role = (decodedPayload.role || decodedPayload.actor_type || "CUSTOMER").toUpperCase();
      const userId = decodedPayload.userId || decodedPayload.actor_id || decodedPayload.sub || "";

      const verifiedPayload: AuthUserPayload = {
        userId,
        role,
        phone: decodedPayload.phone || "",
        customerUid: decodedPayload.customerUid || decodedPayload.customer_uid || (userId.startsWith("cth_cus_") ? userId : undefined),
        customerId: decodedPayload.customerId || decodedPayload.customer_id || userId,
        branchId: decodedPayload.branchId || decodedPayload.branch_id || null,
        partnerId: decodedPayload.partnerId || decodedPayload.partner_id || null,
        name: decodedPayload.name || "",
        email: decodedPayload.email || "",
        permissions: Array.isArray(decodedPayload.permissions) ? decodedPayload.permissions : undefined,
        isSuperAdmin: role === "SUPER_ADMIN" || userId === "admin_01",
        exp: decodedPayload.exp,
        iat: decodedPayload.iat,
      };

      // Cache valid verified token in session store
      registerServerSession(cleanToken, verifiedPayload, Math.max(300, (decodedPayload.exp || 0) - now));

      return verifiedPayload;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extracts and cryptographically verifies user session from NextRequest.
 * Enforces server-authoritative claims and completely discards forged client identity headers.
 */
export function resolveServerSession(req: NextRequest | Request | any): AuthUserPayload | null {
  const cookieHeader = (typeof req.headers?.get === "function" ? req.headers.get("cookie") : "") || "";
  const authHeader = (typeof req.headers?.get === "function" ? req.headers.get("authorization") : "") || "";

  let token: string | null = null;

  // 1. Extract from Authorization header
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  // 2. Extract from req.cookies (NextRequest)
  if (!token && req.cookies && typeof req.cookies.get === "function") {
    token = req.cookies.get("_cth_jwt")?.value || req.cookies.get("_medusa_jwt")?.value || null;
  }

  // 3. Extract from raw Cookie header
  if (!token && cookieHeader) {
    const cookiesObj: Record<string, string> = {};
    cookieHeader.split(";").forEach((c: string) => {
      const [k, ...v] = c.trim().split("=");
      if (k) cookiesObj[k] = decodeURIComponent(v.join("="));
    });

    token = cookiesObj["_cth_jwt"] || cookiesObj["_medusa_jwt"] || null;
  }

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

/**
 * Resolves verified customer identity strictly from a server-validated session.
 * Rejects unverified client-provided phone numbers or customer UIDs.
 */
export function resolveVerifiedCustomer(req: NextRequest | Request | any): {
  customerUid: string;
  customerId: string;
  phone: string;
  userId: string;
} | null {
  const session = resolveServerSession(req);
  if (!session) {
    return null;
  }

  const customerId = session.customerId || session.userId;
  const phone = session.phone ? session.phone.replace(/\D/g, "").slice(-10) : "";
  const customerUid = session.customerUid || (customerId.startsWith("cth_cus_") ? customerId : (phone ? `cth_cus_${phone}` : `cus_${customerId}`));

  return {
    customerUid,
    customerId,
    phone,
    userId: session.userId,
  };
}
