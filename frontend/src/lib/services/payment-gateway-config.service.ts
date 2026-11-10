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
        `SELECT id, provider, environment, key_id, key_secret_enc, webhook_secret_enc, is_active 
         FROM public.payment_gateway_config 
         WHERE provider = $1 AND is_active = true 
         ORDER BY updated_at DESC LIMIT 1`,
        [provider]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
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

    // Default development test sandbox credentials
    return {
      key_id: "rzp_test_placeholder_key_id",
      key_secret: "rzp_test_placeholder_secret",
      webhook_secret: "rzp_test_placeholder_webhook_secret",
      environment: "TEST",
      source: "ENVIRONMENT"
    };
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
      const active = await this.getActiveCredentials("razorpay");
      key_id = active.key_id;
      key_secret = active.key_secret;
      environment = active.environment;
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
          message: "Connection established successfully. Key ID and Key Secret verified with Razorpay API.",
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
