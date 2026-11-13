import syncExchangeRatesJob from "../../../jobs/sync-exchange-rates";
import { GET as liveApi } from "../../../api/health/live/route";
import { GET as readyApi } from "../../../api/health/ready/route";
import { GET as diagnosticsApi } from "../../../api/admin/health/diagnostics/route";
import * as fs from "fs";
import * as path from "path";

describe("Phase 13: PWA & Platform Hardening Unit Tests", () => {
  let mockContainer: any;
  let mockReq: any;
  let mockRes: any;
  let mockLocService: any;
  let currenciesStore: any[];

  beforeEach(() => {
    currenciesStore = [
      { id: "curr_1", code: "USD", rate: 1.0, is_default: true },
      { id: "curr_2", code: "EUR", rate: 1.0, is_default: false },
      { id: "curr_3", code: "INR", rate: 1.0, is_default: false },
    ];

    mockLocService = {
      listCurrencies: jest.fn(async () => currenciesStore),
      updateCurrencies: jest.fn(async (args) => {
        const match = currenciesStore.find((c) => c.id === args.id);
        if (match) {
          match.rate = args.rate;
        }
        return [match];
      }),
    };

    mockReq = {
      query: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "localizationModuleService") return mockLocService;
          if (key === "db_connection" || key === "__pg_connection__") {
            return {
              select: jest.fn().mockResolvedValue([1]),
              raw: jest.fn().mockResolvedValue([1]),
            };
          }
          if (key === "redis") return { status: "ready" };
          if (key === "notificationModuleService") return {};
          return null;
        }),
      },
      auth_context: { actor_id: "admin_1" },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  });

  describe("PWA Caching & Manifest Assets Verification", () => {
    test("verifies web manifest exists and contains standalone details", () => {
      const manifestPath = path.join(__dirname, "../../../../../frontend/public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(manifestContent.display).toBe("standalone");
      expect(["#0F172A", "#e11d48"]).toContain(manifestContent.theme_color);
      expect(manifestContent.icons).toBeDefined();
    });

    test("verifies service worker file is present with runtime interceptors", () => {
      const swPath = path.join(__dirname, "../../../../../frontend/public/sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain("caketohome-cache");
      expect(swContent).toContain("fetch");
    });
  });

  describe("Multi-Currency Schedulers", () => {
    test("syncExchangeRatesJob pulls exchange rates and updates currencies database", async () => {
      const mockContainerObj = {
        resolve: jest.fn((key) => {
          if (key === "localizationModuleService") return mockLocService;
          return null;
        }),
      } as any;

      await syncExchangeRatesJob({ container: mockContainerObj });

      expect(mockLocService.listCurrencies).toHaveBeenCalled();
      expect(mockLocService.updateCurrencies).toHaveBeenCalledTimes(2);

      const eur = currenciesStore.find((c) => c.code === "EUR");
      const inr = currenciesStore.find((c) => c.code === "INR");
      expect(eur.rate).toBe(0.92);
      expect(inr.rate).toBe(83.5);
    });
  });

  describe("Health Diagnostic & Observability APIs", () => {
    test("GET /health/live returns liveness status code 200", async () => {
      await liveApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "live",
        })
      );
    });

    test("GET /health/ready returns database readiness check status", async () => {
      await readyApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ready",
          database: "connected",
        })
      );
    });

    test("GET /admin/health/diagnostics details telemetry details", async () => {
      await diagnosticsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnostics: expect.objectContaining({
            status: "healthy",
            node_version: process.version,
            database: { status: "up" },
            redis: { status: "up" },
          }),
        })
      );
    });
  });
});
