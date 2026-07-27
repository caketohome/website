import SecurityModuleService from "../service";
import { POST as setup2faApi } from "../../../api/admin/auth/2fa/setup/route";
import { POST as verify2faApi } from "../../../api/admin/auth/2fa/verify/route";
import { GET as securityLogsApi } from "../../../api/admin/security/logs/route";
import { POST as ipWhitelistApi } from "../../../api/admin/security/ip-whitelist/route";
import { GET as activeSessionsApi } from "../../../api/admin/security/active-sessions/route";
import { ipWhitelistMiddleware, rateLimitMiddleware } from "../../../middlewares/security";

describe("Phase 15: Security Hardening Unit Tests", () => {
  let service: any;
  let twoFactorsStore: any[];
  let whitelistsStore: any[];
  let blockedStore: any[];
  let eventsStore: any[];
  let auditStore: any[];
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    twoFactorsStore = [];
    whitelistsStore = [];
    blockedStore = [];
    eventsStore = [];
    auditStore = [];

    const dependencies = {};
    service = new (SecurityModuleService as any)(dependencies, {});

    // Stub MedusaService models CRUD operations
    service.createUserTwoFactors = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `usr2fa_${i + 1}`, ...x }));
      twoFactorsStore.push(...c);
      return c;
    });
    service.listUserTwoFactors = jest.fn(async (sel) => {
      return twoFactorsStore.filter((x) => !sel || !sel.user_id || x.user_id === sel.user_id);
    });
    service.updateUserTwoFactors = jest.fn(async (args) => {
      const match = twoFactorsStore.find((x) => x.id === args.id);
      if (match) Object.assign(match, args);
      return [match];
    });

    service.createIpWhitelists = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `ipwl_${i + 1}`, ...x }));
      whitelistsStore.push(...c);
      return c;
    });
    service.listIpWhitelists = jest.fn(async (sel) => {
      return whitelistsStore.filter((x) => !sel || sel.is_active === undefined || x.is_active === sel.is_active);
    });

    service.createBlockedIps = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `blkip_${i + 1}`, ...x }));
      blockedStore.push(...c);
      return c;
    });
    service.listBlockedIps = jest.fn(async (sel) => {
      return blockedStore.filter((x) => !sel || !sel.ip_address || x.ip_address === sel.ip_address);
    });
    service.deleteBlockedIps = jest.fn(async (ids) => {
      blockedStore = blockedStore.filter((x) => !ids.includes(x.id));
    });

    service.createSecurityEvents = jest.fn(async (arr) => {
      const c = arr.map((x, i) => ({ id: `secevt_${i + 1}`, ...x, created_at: new Date() }));
      eventsStore.push(...c);
      return c;
    });
    service.listSecurityEvents = jest.fn(async () => eventsStore);

    // Mock Audit Service
    const mockAuditService = {
      listAuditLogs: jest.fn(async () => auditStore),
    };

    mockReq = {
      query: {},
      params: {},
      body: {},
      ip: "127.0.0.1",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "securityModuleService") return service;
          if (key === "auditModuleService") return mockAuditService;
          return null;
        }),
      },
      auth_context: {
        actor_id: "admin_1",
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe("TOTP Two-Factor Authentication", () => {
    test("generates secret and verifies code with window drift margins", () => {
      const { secret, qrCodeUrl } = service.generateTotpSecret("admin_1");
      expect(secret).toBeDefined();
      expect(qrCodeUrl).toContain("otpauth://totp/");

      // A simple verification check of a freshly generated code
      const timeStep = 30;
      const counter = Math.floor(Date.now() / 1000 / timeStep);
      const code = service.calculateTotp(secret, counter);

      expect(service.verifyTotp(secret, code)).toBe(true);
    });
  });

  describe("IP Whitelisting & CIDR checks", () => {
    test("matches exact IPs and CIDR subnets correctly", async () => {
      // Setup whitelist rules
      await service.createIpWhitelists([
        { ip_address: "192.168.1.1", is_active: true },
        { ip_address: "10.0.0.0/24", is_active: true },
      ]);

      expect(await service.isIpAllowed("192.168.1.1")).toBe(true);
      expect(await service.isIpAllowed("192.168.1.2")).toBe(false);

      expect(await service.isIpAllowed("10.0.0.5")).toBe(true);
      expect(await service.isIpAllowed("10.0.1.5")).toBe(false);
    });
  });

  describe("Failed logins lockout detection", () => {
    test("failed login events lock out IP after 5 attempts", async () => {
      let isBlocked = false;
      for (let i = 0; i < 5; i++) {
        isBlocked = await service.recordFailedLogin("192.168.1.99", "admin_1");
      }

      expect(isBlocked).toBe(true);
      expect(blockedStore).toHaveLength(1);
      expect(blockedStore[0].ip_address).toBe("192.168.1.99");
    });
  });

  describe("Security APIs and Express routes", () => {
    test("POST /admin/auth/2fa/setup registers secrets", async () => {
      await setup2faApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(twoFactorsStore).toHaveLength(1);
    });

    test("POST /admin/auth/2fa/verify enables 2FA when code is correct", async () => {
      const { secret } = service.generateTotpSecret("admin_1");
      twoFactorsStore.push({ id: "usr2fa_1", user_id: "admin_1", secret, is_enabled: false });

      const timeStep = 30;
      const counter = Math.floor(Date.now() / 1000 / timeStep);
      const code = service.calculateTotp(secret, counter);

      mockReq.body = { code };
      await verify2faApi(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(twoFactorsStore[0].is_enabled).toBe(true);
    });

    test("GET /admin/security/logs pulls data maps", async () => {
      await securityLogsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test("POST /admin/security/ip-whitelist registers CIDRs", async () => {
      mockReq.body = { ip_address: "192.168.20.0/24", description: "Trusted developers subnet" };
      await ipWhitelistApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(whitelistsStore).toHaveLength(1);
    });

    test("GET /admin/security/active-sessions reports sessions list", async () => {
      await activeSessionsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Middlewares verification", () => {
    test("ipWhitelistMiddleware blocks restricted IPs", async () => {
      // Configure IP whitelist restriction
      await service.createIpWhitelists([{ ip_address: "10.0.0.1", is_active: true }]);
      mockReq.ip = "192.168.1.1";

      await ipWhitelistMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("rateLimitMiddleware limits heavy traffic", async () => {
      mockReq.ip = "1.2.3.4";
      for (let i = 0; i < 101; i++) {
        await rateLimitMiddleware(mockReq, mockRes, mockNext);
      }
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });
});
