import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  admin: {
    backendUrl: process.env.BACKEND_URL || "http://localhost:9000",
    disable: true,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      connection: {
        ssl: false,
      },
      pool: {
        min: 2,
        max: 30,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
    },
    http: {
      storeCors: process.env.STORE_CORS,
      adminCors: process.env.ADMIN_CORS,
      authCors: process.env.AUTH_CORS,
      jwtSecret: process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET environment variable is required"); })(),
      cookieSecret: process.env.COOKIE_SECRET || (() => { throw new Error("COOKIE_SECRET environment variable is required"); })(),
    },
  },
  modules: {
    shopModuleService: {
      resolve: "./modules/shop",
    },
    deliveryModuleService: {
      resolve: "./modules/delivery",
    },
    settingsModuleService: {
      resolve: "./modules/settings",
    },
    notificationModuleService: {
      resolve: "./modules/notification",
    },
    rulesModuleService: {
      resolve: "./modules/rules",
    },
    analyticsModuleService: {
      resolve: "./modules/analytics",
    },
    mediaModuleService: {
      resolve: "./modules/media",
    },
    localizationModuleService: {
      resolve: "./modules/localization",
    },
    auditModuleService: {
      resolve: "./modules/audit",
    },
    paymentModuleService: {
      resolve: "./modules/payment",
    },
    webhookModuleService: {
      resolve: "./modules/webhook",
    },
    customerModuleService: {
      resolve: "./modules/customer",
    },
    cmsModuleService: {
      resolve: "./modules/cms",
    },
    catalogModuleService: {
      resolve: "./modules/catalog",
    },
    orderLifecycleModuleService: {
      resolve: "./modules/order-lifecycle",
    },
    crmModuleService: {
      resolve: "./modules/crm",
    },
    marketingModuleService: {
      resolve: "./modules/marketing",
    },
    supportModuleService: {
      resolve: "./modules/support",
    },
    securityModuleService: {
      resolve: "./modules/security",
    },
    integrationModuleService: {
      resolve: "./modules/integration",
    },
    [Modules.FULFILLMENT]: {
      options: {
        providers: [
          {
            resolve: "@medusajs/fulfillment-manual",
            id: "manual-provider",
          },
        ],
      },
    },
  },
});
