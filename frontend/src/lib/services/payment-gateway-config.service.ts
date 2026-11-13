/**
 * CakeToHome — Payment Gateway Configuration & Cryptographic Service
 * 
 * Implements:
 * 1. Versioned AES-256-GCM authenticated encryption envelope (v1$iv$authTag$cipher)
 * 2. Key rotation protocol support (v1, v2) with zero plaintext persistence
 * 3. Safe database persistence and retrieval of gateway credentials
 * 4. Hardened non-mutating credential diagnostic probe (SSRF prevention, 5s timeout, manual redirect)
 * 5. Redaction and sanitization guarantees (no credentials in logs or client payloads)
 */

import crypto from "crypto";
import { dbQuery } from "../db";

export interface GatewayConfigDTO {
  id?: string;
  provider: string;
  environment: "TEST" | "LIVE";
  key_id: string;
  key_secret?: string; // only present on write
  webhook_secret?: string; // optional on write
  is_active: boolean;
  has_key_secret?: boolean; // returned on read
  has_webhook_secret?: boolean; // returned on read
  last_tested_at?: string | null;
  last_test_result?: any;
  created_at?: string;
  updated_at?: string;
}

export interface DiagnosticProbeResult {
  success: boolean;
  status_code: number;
  environment: "TEST" | "LIVE";
  category: "SUCCESS" | "INVALID_KEY_ID" | "INVALID_KEY_SECRET" | "INSUFFICIENT_PERMISSIONS" | "PROVIDER_TIMEOUT" | "PROVIDER_OUTAGE" | "NETWORK_FAILURE" | "UNSUPPORTED_ENVIRONMENT";
  message: string;
  tested_at: string;
}

export interface GatewayEnvView {
  environment: "TEST" | "LIVE";
  configured: boolean;
  key_id: string;
  has_key_secret: boolean;
  has_webhook_secret: boolean;
  status: "NOT_CONFIGURED" | "UNTESTED" | "VERIFIED" | "FAILED";
  last_tested_at: string | null;
  last_test_result: any;
  updated_at: string | null;
  is_active: boolean;
}

export class GatewaySecretEncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly CURRENT_VERSION = "v1";
  private static readonly DEFAULT_TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  /**
   * Encrypts plaintext secret into versioned envelope string:
   * v1$iv_hex$auth_tag_hex$ciphertext_hex
   */
  public static encryptSecret(plaintext: string): string {
    if (!plaintext || typeof plaintext !== "string") {
      throw new Error("CANNOT_ENCRYPT_EMPTY_SECRET");
    }
    const masterKey = this.getMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit nonce
    const cipher = crypto.createCipheriv(this.ALGORITHM, masterKey, iv);

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${this.CURRENT_VERSION}$${iv.toString("hex")}$${authTag}$${ciphertext}`;
  }

  /**
   * Decrypts versioned envelope string back to plaintext
   */
  public static decryptSecret(envelopeStr: string): string {
    if (!envelopeStr || typeof envelopeStr !== "string") {
      throw new Error("CANNOT_DECRYPT_EMPTY_ENVELOPE");
    }

    const parts = envelopeStr.split("$");
    if (parts.length !== 4) {
      throw new Error("INVALID_ENCRYPTION_ENVELOPE_FORMAT");
    }

    const [version, ivHex, authTagHex, ciphertextHex] = parts;
    const masterKey = this.getMasterKeyForVersion(version);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(this.ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8"); // Throws error if auth tag is invalid or tampered
    return decrypted;
  }

  private static getMasterKey(): Buffer {
    let keyHex = process.env.GATEWAY_SECRET_MASTER_KEY;
    if (!keyHex || keyHex.length !== 64) {
      if (process.env.NODE_ENV !== "production") {
        keyHex = this.DEFAULT_TEST_KEY;
      } else {
        throw new Error("FATAL: GATEWAY_SECRET_MASTER_KEY must be a 64-character hex string (32 bytes).");
      }
    }
    return Buffer.from(keyHex, "hex");
  }

  private static getMasterKeyForVersion(version: string): Buffer {
    if (version === "v1") return this.getMasterKey();
    const versionedKey = process.env[`GATEWAY_SECRET_MASTER_KEY_${version.toUpperCase()}`];
    if (versionedKey && versionedKey.length === 64) {
      return Buffer.from(versionedKey, "hex");
    }
    return this.getMasterKey();
  }
}

export class PaymentGatewayConfigService {
  /**
   * Retrieves active credentials for a gateway provider.
   * Priority: Active Database Config -> Fallback Environment Variables
   */
  public static async getActiveCredentials(provider: string = "razorpay"): Promise<{
    key_id: string;
    key_secret: string;
    webhook_secret?: string;
    environment: "TEST" | "LIVE";
    source: "DATABASE" | "ENVIRONMENT";
  }> {
    try {
      const res = await dbQuery(
        `SELECT id, provider, environment, key_id, key_secret_enc, webhook_secret_enc, is_active, last_test_result
         FROM public.payment_gateway_config
         WHERE provider = $1 AND is_active = true
         ORDER BY updated_at DESC LIMIT 1`,
        [provider]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        // Live payments stay non-operational until a real authenticated Razorpay probe has passed for the stored Live credentials.
        if (String(row.environment).toUpperCase() === "LIVE" && row.last_test_result?.success !== true) {
          throw new Error("LIVE_NOT_VERIFIED: Live credentials have not passed a Razorpay connection test.");
        }
        const key_secret = GatewaySecretEncryptionService.decryptSecret(row.key_secret_enc);
        let webhook_secret: string | undefined;
        if (row.webhook_secret_enc) {
          try {
            webhook_secret = GatewaySecretEncryptionService.decryptSecret(row.webhook_secret_enc);
          } catch (e) {
            console.warn("[PaymentGatewayConfig] Warning: Failed to decrypt webhook secret, ignoring.");
          }
        }

        return {
          key_id: row.key_id,
          key_secret,
          webhook_secret,
          environment: (row.environment?.toUpperCase() === "LIVE" ? "LIVE" : "TEST"),
          source: "DATABASE"
        };
      }
    } catch (dbErr: any) {
      if (String(dbErr?.message || "").startsWith("LIVE_NOT_VERIFIED")) throw dbErr;
      console.warn("[PaymentGatewayConfig] Could not query database config, checking env vars:", dbErr.message);
    }

    // Fallback to environment variables
    const envKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const envKeySecret = process.env.RAZORPAY_KEY_SECRET;
    const envWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (envKeyId && envKeySecret) {
      const isLive = envKeyId.startsWith("rzp_live");
      return {
        key_id: envKeyId,
        key_secret: envKeySecret,
        webhook_secret: envWebhookSecret,
        environment: isLive ? "LIVE" : "TEST",
        source: "ENVIRONMENT"
      };
    }

    throw new Error("GATEWAY_NOT_CONFIGURED: No Razorpay credentials are configured. Add them in Admin > Payment Settings.");
  }

  /**
   * Retrieves sanitized gateway config for Admin UI display (secrets redacted)
   */
  public static async getAdminConfig(provider: string = "razorpay"): Promise<GatewayConfigDTO | null> {
    const res = await dbQuery(
      `SELECT id, provider, environment, key_id, key_secret_enc, webhook_secret_enc, is_active, 
              last_tested_at, last_test_result, created_at, updated_at
       FROM public.payment_gateway_config 
       WHERE provider = $1 
       ORDER BY updated_at DESC LIMIT 1`,
      [provider]
    );

    if (res.rows.length === 0) {
      // Return env fallback representation
      const envKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
      return {
        provider,
        environment: envKeyId.startsWith("rzp_live") ? "LIVE" : "TEST",
        key_id: envKeyId,
        is_active: Boolean(envKeyId),
        has_key_secret: Boolean(process.env.RAZORPAY_KEY_SECRET),
        has_webhook_secret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
        last_tested_at: null,
        last_test_result: null
      };
    }

    const row = res.rows[0];
    return {
      id: row.id,
      provider: row.provider,
      environment: row.environment,
      key_id: row.key_id,
      is_active: row.is_active,
      has_key_secret: Boolean(row.key_secret_enc),
      has_webhook_secret: Boolean(row.webhook_secret_enc),
      last_tested_at: row.last_tested_at ? row.last_tested_at.toISOString() : null,
      last_test_result: row.last_test_result,
      created_at: row.created_at ? row.created_at.toISOString() : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null
    };
  }

  /**
   * Saves or updates gateway credentials with AES-256-GCM encryption
   */
  public static async saveAdminConfig(dto: {
    provider: string;
    environment: "TEST" | "LIVE";
    key_id: string;
    key_secret?: string;
    webhook_secret?: string;
    is_active: boolean;
    updated_by?: string;
  }): Promise<{ success: boolean; id: string }> {
    const { provider, environment, key_id, key_secret, webhook_secret, is_active, updated_by } = dto;

    if (!key_id || !key_id.trim()) {
      throw new Error("KEY_ID_REQUIRED");
    }

    // Check existing row
    const existing = await dbQuery(
      `SELECT id, key_secret_enc, webhook_secret_enc FROM public.payment_gateway_config 
       WHERE provider = $1 AND environment = $2`,
      [provider, environment]
    );

    let keySecretEnc: string;
    if (key_secret && key_secret.trim()) {
      keySecretEnc = GatewaySecretEncryptionService.encryptSecret(key_secret.trim());
    } else if (existing.rows.length > 0 && existing.rows[0].key_secret_enc) {
      keySecretEnc = existing.rows[0].key_secret_enc;
    } else {
      throw new Error("KEY_SECRET_REQUIRED");
    }

    let webhookSecretEnc: string | null = null;
    if (webhook_secret && webhook_secret.trim()) {
      webhookSecretEnc = GatewaySecretEncryptionService.encryptSecret(webhook_secret.trim());
    } else if (existing.rows.length > 0 && existing.rows[0].webhook_secret_enc) {
      webhookSecretEnc = existing.rows[0].webhook_secret_enc;
    }

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await dbQuery(
        `UPDATE public.payment_gateway_config 
         SET key_id = $1, key_secret_enc = $2, webhook_secret_enc = $3, is_active = $4, 
             updated_by = $5, updated_at = NOW() 
         WHERE id = $6`,
        [key_id.trim(), keySecretEnc, webhookSecretEnc, is_active, updated_by || "admin_system", id]
      );
      return { success: true, id };
    } else {
      const insertRes = await dbQuery(
        `INSERT INTO public.payment_gateway_config 
         (provider, environment, key_id, key_secret_enc, webhook_secret_enc, is_active, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) 
         RETURNING id`,
        [provider, environment, key_id.trim(), keySecretEnc, webhookSecretEnc, is_active, updated_by || "admin_system"]
      );
      return { success: true, id: insertRes.rows[0].id };
    }
  }

  private static readonly KEY_ID_PATTERN: Record<"TEST" | "LIVE", RegExp> = {
    TEST: /^rzp_test_[A-Za-z0-9]{6,40}$/,
    LIVE: /^rzp_live_[A-Za-z0-9]{6,40}$/
  };

  /**
   * Safe, secret-free view of BOTH environments plus the single active environment.
   * Live is only "operational" after a real authenticated probe succeeded.
   * KYC and settlement-bank status cannot be verified by the application and are reported as such.
   */
  public static async getAdminConfigAll(provider: string = "razorpay"): Promise<{
    provider: string;
    active_environment: "TEST" | "LIVE" | null;
    live_operational: boolean;
    kyc_status: "NOT_VERIFIED_BY_APPLICATION";
    settlement_status: "NOT_VERIFIED_BY_APPLICATION";
    environments: Record<"TEST" | "LIVE", GatewayEnvView>;
  }> {
    const res = await dbQuery(
      `SELECT environment, key_id, key_secret_enc, webhook_secret_enc, is_active, last_tested_at, last_test_result, updated_at
       FROM public.payment_gateway_config WHERE provider = $1`,
      [provider]
    );
    const blank = (environment: "TEST" | "LIVE"): GatewayEnvView => ({
      environment, configured: false, key_id: "", has_key_secret: false, has_webhook_secret: false,
      status: "NOT_CONFIGURED", last_tested_at: null, last_test_result: null, updated_at: null, is_active: false
    });
    const environments: Record<"TEST" | "LIVE", GatewayEnvView> = { TEST: blank("TEST"), LIVE: blank("LIVE") };
    for (const row of res.rows) {
      const env: "TEST" | "LIVE" = String(row.environment).toUpperCase() === "LIVE" ? "LIVE" : "TEST";
      const result = row.last_test_result;
      environments[env] = {
        environment: env,
        configured: Boolean(row.key_id && row.key_secret_enc),
        key_id: row.key_id || "",
        has_key_secret: Boolean(row.key_secret_enc),
        has_webhook_secret: Boolean(row.webhook_secret_enc),
        status: result ? (result.success ? "VERIFIED" : "FAILED") : "UNTESTED",
        last_tested_at: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : null,
        last_test_result: result ? { success: Boolean(result.success), category: result.category, message: result.message } : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        is_active: Boolean(row.is_active)
      };
    }
    const active = environments.LIVE.is_active ? "LIVE" : environments.TEST.is_active ? "TEST" : null;
    return {
      provider,
      active_environment: active,
      live_operational: active === "LIVE" && environments.LIVE.status === "VERIFIED",
      kyc_status: "NOT_VERIFIED_BY_APPLICATION",
      settlement_status: "NOT_VERIFIED_BY_APPLICATION",
      environments
    };
  }

  /** Server-only. Loads one environment's stored credentials without the Live-verification gate (used by the diagnostic probe). */
  public static async getEnvironmentCredentials(provider: string, environment: "TEST" | "LIVE"): Promise<{ key_id: string; key_secret: string; webhook_secret?: string } | null> {
    const res = await dbQuery(
      `SELECT key_id, key_secret_enc, webhook_secret_enc FROM public.payment_gateway_config WHERE provider = $1 AND environment = $2`,
      [provider, environment]
    );
    if (res.rows.length === 0 || !res.rows[0].key_secret_enc) return null;
    const row = res.rows[0];
    return {
      key_id: row.key_id,
      key_secret: GatewaySecretEncryptionService.decryptSecret(row.key_secret_enc),
      webhook_secret: row.webhook_secret_enc ? GatewaySecretEncryptionService.decryptSecret(row.webhook_secret_enc) : undefined
    };
  }

  /**
   * Partial, optimistic-concurrency update of ONE environment's credentials.
   * Omitted/empty secrets keep the stored value. Changing key id or secret invalidates the previous probe result.
   * Never touches the other environment and never changes which environment is active.
   */
  public static async saveEnvironmentCredentials(dto: {
    provider?: string;
    environment: "TEST" | "LIVE";
    key_id?: string;
    key_secret?: string;
    webhook_secret?: string;
    expected_updated_at?: string | null;
    updated_by: string;
  }): Promise<void> {
    const provider = dto.provider || "razorpay";
    const environment = dto.environment;
    const keyId = dto.key_id?.trim() || "";
    const keySecret = dto.key_secret?.trim() || "";
    const webhookSecret = dto.webhook_secret?.trim() || "";

    if (keyId && !this.KEY_ID_PATTERN[environment].test(keyId)) {
      throw new Error(`INVALID_KEY_ID_FORMAT: ${environment === "LIVE" ? "Live" : "Test"} Key ID must start with rzp_${environment.toLowerCase()}_.`);
    }

    const existing = await dbQuery(
      `SELECT id, key_id, key_secret_enc, updated_at FROM public.payment_gateway_config WHERE provider = $1 AND environment = $2`,
      [provider, environment]
    );

    if (existing.rows.length === 0) {
      if (!keyId) throw new Error("KEY_ID_REQUIRED: Key ID is required.");
      if (!keySecret) throw new Error("KEY_SECRET_REQUIRED: Key Secret is required.");
      try {
        await dbQuery(
          `INSERT INTO public.payment_gateway_config
           (provider, environment, key_id, key_secret_enc, webhook_secret_enc, is_active, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
          [provider, environment, keyId,
           GatewaySecretEncryptionService.encryptSecret(keySecret),
           webhookSecret ? GatewaySecretEncryptionService.encryptSecret(webhookSecret) : null,
           dto.updated_by]
        );
      } catch (e: any) {
        if (e?.code === "23505") throw new Error("STALE_CONFIG: Configuration was changed by another administrator. Reload and retry.");
        throw e;
      }
      return;
    }

    const row = existing.rows[0];
    const credentialsChanged = (keyId && keyId !== row.key_id) || Boolean(keySecret);
    const res = await dbQuery(
      `UPDATE public.payment_gateway_config
       SET key_id = COALESCE($1, key_id),
           key_secret_enc = COALESCE($2, key_secret_enc),
           webhook_secret_enc = COALESCE($3, webhook_secret_enc),
           last_tested_at = CASE WHEN $4 THEN NULL ELSE last_tested_at END,
           last_test_result = CASE WHEN $4 THEN NULL ELSE last_test_result END,
           updated_by = $5, updated_at = NOW()
       WHERE id = $6
         AND ($7::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $7::timestamptz))`,
      [keyId || null,
       keySecret ? GatewaySecretEncryptionService.encryptSecret(keySecret) : null,
       webhookSecret ? GatewaySecretEncryptionService.encryptSecret(webhookSecret) : null,
       credentialsChanged, dto.updated_by, row.id, dto.expected_updated_at || null]
    );
    if (res.rowCount === 0) throw new Error("STALE_CONFIG: Configuration was changed by another administrator. Reload and retry.");
  }

  /**
   * Atomically makes exactly one environment active (single UPDATE statement).
   * Refuses to activate an environment that has no stored credentials.
   */
  public static async setActiveEnvironment(provider: string, environment: "TEST" | "LIVE", updatedBy: string): Promise<void> {
    const target = await dbQuery(
      `SELECT key_id, key_secret_enc FROM public.payment_gateway_config WHERE provider = $1 AND environment = $2`,
      [provider, environment]
    );
    if (target.rows.length === 0 || !target.rows[0].key_secret_enc || !target.rows[0].key_id) {
      throw new Error(`ENVIRONMENT_NOT_CONFIGURED: ${environment === "LIVE" ? "Live" : "Test"} credentials are not configured.`);
    }
    await dbQuery(
      `UPDATE public.payment_gateway_config
       SET is_active = (environment = $2), updated_by = $3, updated_at = NOW()
       WHERE provider = $1 AND is_active IS DISTINCT FROM (environment = $2)`,
      [provider, environment, updatedBy]
    );
  }

  /** Best-effort audit trail in the existing auth_audit_events table. Never receives secret values. */
  public static async recordAudit(event: { actor: string; action: string; status: "SUCCESS" | "FAILURE"; environment?: string; fields?: string[]; code?: string }): Promise<void> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.actor);
      await dbQuery(
        `INSERT INTO public.auth_audit_events (user_id, event_type, status, metadata) VALUES ($1, $2, $3, $4)`,
        [isUuid ? event.actor : null, `PAYMENT_GATEWAY_${event.action}`.slice(0, 50), event.status,
         JSON.stringify({ actor: event.actor, provider: "razorpay", environment: event.environment, changed_fields: event.fields, code: event.code })]
      );
    } catch {
      console.warn("[PaymentGatewayConfig] audit write failed");
    }
  }

  /**
   * Non-mutating Diagnostic Connection Probe (CTH-P9-005)
   * Enforces hardcoded Razorpay endpoint, SSRF prevention, 5s timeout, manual redirect.
   */
  public static async testConnection(credentials?: {
    key_id: string;
    key_secret?: string;
    environment?: "TEST" | "LIVE";
  }): Promise<DiagnosticProbeResult> {
    const tested_at = new Date().toISOString();
    let key_id: string;
    let key_secret: string;
    let environment: "TEST" | "LIVE" = credentials?.environment || "TEST";

    if (credentials?.key_id && credentials?.key_secret) {
      key_id = credentials.key_id.trim();
      key_secret = credentials.key_secret.trim();
    } else {
      // Probe the STORED credentials of the requested environment (or the active one) - never another environment's.
      let target = credentials?.environment;
      if (!target) {
        const cfg = await this.getAdminConfigAll("razorpay");
        target = cfg.active_environment || "TEST";
      }
      const stored = await this.getEnvironmentCredentials("razorpay", target);
      if (!stored) {
        return {
          success: false,
          status_code: 400,
          environment: target,
          category: "INVALID_KEY_ID",
          message: `${target === "LIVE" ? "Live" : "Test"} credentials are not configured.`,
          tested_at
        };
      }
      key_id = stored.key_id;
      key_secret = stored.key_secret;
      environment = target;
    }

    // Invariant: Verify key format against selected environment
    if (environment === "TEST" && key_id.startsWith("rzp_live")) {
      return {
        success: false,
        status_code: 400,
        environment,
        category: "UNSUPPORTED_ENVIRONMENT",
        message: "Live Key ID supplied while configuration environment is set to Test Mode.",
        tested_at
      };
    }
    if (environment === "LIVE" && key_id.startsWith("rzp_test")) {
      return {
        success: false,
        status_code: 400,
        environment,
        category: "UNSUPPORTED_ENVIRONMENT",
        message: "Test Key ID supplied while configuration environment is set to Live Mode.",
        tested_at
      };
    }

    // SSRF Prevention: Destination is strictly hardcoded
    const TARGET_URL = "https://api.razorpay.com/v1/payments?count=1";
    const authHeader = "Basic " + Buffer.from(`${key_id}:${key_secret}`).toString("base64");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5000ms strict timeout

    try {
      const response = await fetch(TARGET_URL, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json"
        },
        redirect: "manual", // Do NOT follow redirects
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const statusCode = response.status;

      let result: DiagnosticProbeResult;
      if (statusCode === 200) {
        result = {
          success: true,
          status_code: 200,
          environment,
          category: "SUCCESS",
          message: "Authenticated with the Razorpay API using the stored Key ID and Key Secret. This does not confirm merchant KYC, live-payment approval or settlement-bank verification.",
          tested_at
        };
      } else if (statusCode === 401) {
        result = {
          success: false,
          status_code: 401,
          environment,
          category: "INVALID_KEY_SECRET",
          message: "Authentication failed. Invalid Razorpay Key ID or Key Secret.",
          tested_at
        };
      } else if (statusCode === 403) {
        result = {
          success: false,
          status_code: 403,
          environment,
          category: "INSUFFICIENT_PERMISSIONS",
          message: "Access forbidden. Key does not have sufficient permissions to query payment data.",
          tested_at
        };
      } else if (statusCode >= 500) {
        result = {
          success: false,
          status_code: statusCode,
          environment,
          category: "PROVIDER_OUTAGE",
          message: `Razorpay upstream returned server error (HTTP ${statusCode}).`,
          tested_at
        };
      } else {
        result = {
          success: false,
          status_code: statusCode,
          environment,
          category: "NETWORK_FAILURE",
          message: `Unexpected response status from payment provider (HTTP ${statusCode}).`,
          tested_at
        };
      }

      // Record test result in DB if config exists
      try {
        await dbQuery(
          `UPDATE public.payment_gateway_config 
           SET last_tested_at = NOW(), last_test_result = $1 
           WHERE provider = 'razorpay' AND environment = $2`,
          [JSON.stringify(result), environment]
        );
      } catch (e) {
        // Non-critical if table update fails
      }

      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);

      let category: DiagnosticProbeResult["category"] = "NETWORK_FAILURE";
      let message = "Network error connecting to payment gateway.";

      if (err.name === "AbortError" || err.message?.includes("abort")) {
        category = "PROVIDER_TIMEOUT";
        message = "Gateway diagnostic request timed out after 5000ms.";
      } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
        category = "NETWORK_FAILURE";
        message = `DNS or socket connection failed (${err.code}).`;
      }

      const result: DiagnosticProbeResult = {
        success: false,
        status_code: 0,
        environment,
        category,
        message,
        tested_at
      };

      try {
        await dbQuery(
          `UPDATE public.payment_gateway_config 
           SET last_tested_at = NOW(), last_test_result = $1 
           WHERE provider = 'razorpay' AND environment = $2`,
          [JSON.stringify(result), environment]
        );
      } catch (e) {}

      return result;
    }
  }
}

