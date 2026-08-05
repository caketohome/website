import { MedusaService } from "@medusajs/utils";
import * as crypto from "crypto";
import { UserTwoFactor, IpWhitelist, BlockedIp, SecurityEvent } from "./models";

class SecurityModuleService extends MedusaService({
  UserTwoFactor,
  IpWhitelist,
  BlockedIp,
  SecurityEvent,
}) {
  protected container: any;

  constructor(dependencies: any, ...args: any[]) {
    super(dependencies, ...args);
    this.container = dependencies;
  }

  // ── Two-Factor Authentication (TOTP) ────────────────────────────────────

  generateTotpSecret(userId: string): { secret: string; qrCodeUrl: string } {
    // Generate a random 20-byte secret and format as hex
    const secret = crypto.randomBytes(20).toString("hex");
    // Format standard otpauth URL
    const label = encodeURIComponent(`CakeToHome:${userId}`);
    const qrCodeUrl = `otpauth://totp/${label}?secret=${secret}&issuer=CakeToHome&algorithm=SHA1&digits=6&period=30`;

    return { secret, qrCodeUrl };
  }

  verifyTotp(secret: string, code: string): boolean {
    const timeStep = 30; // 30 seconds
    const currentTime = Math.floor(Date.now() / 1000);

    // Verify code with a clock-drift window of 1 step before/after
    for (let offset = -1; offset <= 1; offset++) {
      const counter = Math.floor(currentTime / timeStep) + offset;
      const expectedCode = this.calculateTotp(secret, counter);
      if (expectedCode === code) {
        return true;
      }
    }

    return false;
  }

  private calculateTotp(secretHex: string, counter: number): string {
    const key = Buffer.from(secretHex, "hex");
    const buffer = Buffer.alloc(8);
    // Write counter value as 64-bit integer
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(counter, 4);

    const hmac = crypto.createHmac("sha1", key);
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, "0");
  }

  // ── IP Whitelisting & CIDR Support ──────────────────────────────────────

  async isIpAllowed(ip: string): Promise<boolean> {
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.includes("127.0.0.1")) {
      return true;
    }
    // Check if blocked first
    const [blocked] = await (this as any).listBlockedIps({ ip_address: ip });
    if (blocked) {
      const now = new Date();
      if (new Date(blocked.blocked_until) > now) {
        return false; // Still blocked
      }
      // Block expired, clean up
      await (this as any).deleteBlockedIps([blocked.id]);
    }

    // Check whitelists
    const whitelists = await (this as any).listIpWhitelists({ is_active: true });
    if (whitelists.length === 0) {
      return true; // No restrictions configured
    }

    for (const wl of whitelists) {
      if (this.matchIpOrCidr(ip, wl.ip_address)) {
        return true;
      }
    }

    return false;
  }

  private matchIpOrCidr(ip: string, pattern: string): boolean {
    if (pattern === "*" || pattern === "0.0.0.0/0") return true;
    if (ip === pattern) return true;

    // Simple CIDR block validation (e.g. 192.168.1.0/24)
    if (pattern.includes("/")) {
      const [subnet, maskStr] = pattern.split("/");
      const mask = parseInt(maskStr, 10);
      if (isNaN(mask)) return false;

      const ipNum = this.ipToLong(ip);
      const subnetNum = this.ipToLong(subnet);
      if (ipNum === 0 || subnetNum === 0) return false;

      const netmask = ~(2 ** (32 - mask) - 1);
      return (ipNum & netmask) === (subnetNum & netmask);
    }

    // Simple wildcard support (e.g. 192.168.1.*)
    if (pattern.includes("*")) {
      const prefix = pattern.replace("*", "");
      return ip.startsWith(prefix);
    }

    return false;
  }

  private ipToLong(ip: string): number {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return 0;
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  // ── Brute Force Detection & Lockouts ─────────────────────────────────────

  async recordFailedLogin(ip: string, userId: string | null): Promise<boolean> {
    // Record security log event
    await (this as any).createSecurityEvents([
      {
        ip_address: ip,
        user_id: userId,
        event_type: "failed_login",
        severity: "medium",
        details: `Failed login attempt for user ${userId || "unknown"}`,
      },
    ]);

    // Count failed attempts within last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await (this as any).listSecurityEvents({
      ip_address: ip,
      event_type: "failed_login",
    });

    const recentFailures = events.filter((e: any) => new Date(e.created_at) > tenMinutesAgo);

    if (recentFailures.length >= 5) {
      // Block IP for 30 minutes
      const until = new Date(Date.now() + 30 * 60 * 1000);
      await (this as any).createBlockedIps([
        {
          ip_address: ip,
          reason: "Too many failed login attempts",
          blocked_until: until,
        },
      ]);
      await (this as any).createSecurityEvents([
        {
          ip_address: ip,
          event_type: "blocked_ip",
          severity: "high",
          details: `IP ${ip} temporarily blocked until ${until.toISOString()}`,
        },
      ]);
      return true; // Indicates IP was blocked
    }

    return false;
  }
}

export default SecurityModuleService;
export const SECURITY_MODULE = "securityModuleService";
