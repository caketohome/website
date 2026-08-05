import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework";
import { SECURITY_MODULE } from "../modules/security/service";

// In-memory slide limits map fallback (if redis not reachable)
const rateLimiterCache = new Map<string, { count: number; resetAt: number }>();

/**
 * IP Whitelisting Middleware
 * Restricts access to administrative endpoints based on allowed subnets/CIDR blocks.
 */
export async function ipWhitelistMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const securityService = req.scope.resolve(SECURITY_MODULE) as any;
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.includes("127.0.0.1");
  if (isLocalhost || process.env.NODE_ENV === "development") {
    return next();
  }

  try {
    const isAllowed = await securityService.isIpAllowed(ip);
    if (!isAllowed) {
      // Log event
      await securityService.createSecurityEvents([
        {
          ip_address: ip,
          event_type: "blocked_ip_attempt",
          severity: "high",
          details: `Forbidden access attempt from restricted IP address: ${ip}`,
        },
      ]);
      return res.status(403).json({ message: "Forbidden. IP not whitelisted." });
    }
    next();
  } catch (error: any) {
    next(error);
  }
}

/**
 * API Rate Limiting Middleware
 * Throttles client requests to protect endpoints.
 */
export async function rateLimitMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.includes("127.0.0.1");
  const limit = isLocalhost || process.env.NODE_ENV === "development" ? 10000 : 100; // Allow higher limit for local dev/testing
  const period = 15 * 60 * 1000;
  const now = Date.now();

  let cached = rateLimiterCache.get(ip);
  if (!cached || now > cached.resetAt) {
    cached = { count: 0, resetAt: now + period };
  }

  cached.count += 1;
  rateLimiterCache.set(ip, cached);

  if (cached.count > limit) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  next();
}

/**
 * Two-Factor Authentication Check Middleware
 * Enforces admin routes to be blocked if the session requires TOTP verification completion.
 */
export async function twoFactorMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const actorId = (req as any).auth_context?.actor_id;
  const securityService = req.scope.resolve(SECURITY_MODULE) as any;

  if (actorId) {
    const [credentials] = await securityService.listUserTwoFactors({ user_id: actorId });
    // If user enabled 2FA, check if verification OTP has been confirmed in current request context session
    if (credentials?.is_enabled && !(req as any).auth_context?.app_metadata?.two_factor_verified) {
      return res.status(401).json({
        message: "Two-Factor authentication code required.",
        two_factor_required: true,
      });
    }
  }

  next();
}
