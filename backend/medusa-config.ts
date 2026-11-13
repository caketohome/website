import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// --- Runtime Environment Variable Validation ---
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'COOKIE_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`❌ FATAL ERROR: ${envVar} environment variable is missing. Check your .env file.`);
  }
}
// -----------------------------------------------

module.exports = defineConfig({
  admin: {
    backendUrl: process.env.BACKEND_URL || "http://localhost:9000",
    disable: true,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    databaseDriverOptions: {
      connection: {
        ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false,
      },
      pool: {
        min: 2,
        max: 10,
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
    ...(process.env.REDIS_URL ? {
      [Modules.EVENT_BUS]: {
        resolve: "@medusajs/event-bus-redis",
        options: {
          redisUrl: process.env.REDIS_URL,
        },
      },
      [Modules.WORKFLOW_ENGINE]: {
        resolve: "@medusajs/workflow-engine-redis",
        options: {
          redis: {
            url: process.env.REDIS_URL,
          },
        },
      },
    } : {}),
    ...(process.env.AWS_S3_BUCKET_NAME ? {
      [Modules.FILE]: {
        resolve: "@medusajs/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/file-s3",
              id: "s3",
              options: {
                file_url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,
                access_key_id: process.env.AWS_ACCESS_KEY_ID,
                secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION,
                bucket: process.env.AWS_S3_BUCKET_NAME,
              },
            },
          ],
        },
      },
    } : {}),
  },
});
