export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface ExceptionTelemetry {
  errorType?: string;
  errorCode?: string;
  retryable?: boolean;
}

export interface StructuredLogContext {
  service?: string;
  environment?: string;
  traceId?: string;
  requestId?: string;
  orderId?: string;
  customerId?: string;
  driverId?: string;
  event: string;
  durationMs?: number;
  exception?: ExceptionTelemetry;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_PATTERNS = [
  "password",
  "otp",
  "token",
  "authorization",
  "secret",
  "creditcard",
  "cardnumber",
  "cvv",
  "pin",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "bearertoken",
  "clientsecret",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function redactValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "object" && !Array.isArray(val)) {
    return redactSensitiveFields(val as Record<string, unknown>);
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactValue(item));
  }
  return val;
}

export function redactSensitiveFields(obj: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactValue(value);
    }
  }

  return redacted;
}

export function logTelemetry(level: LogLevel, message: string, ctx: StructuredLogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: ctx.service || "caketohome-core",
    environment: ctx.environment || (process.env.NODE_ENV ?? "development"),
    message,
    trace_id: ctx.traceId || `tr_${Math.random().toString(36).substring(2, 9)}`,
    request_id: ctx.requestId || `req_${Math.random().toString(36).substring(2, 9)}`,
    order_id: ctx.orderId || null,
    customer_id: ctx.customerId || null,
    driver_id: ctx.driverId || null,
    event: ctx.event,
    duration_ms: ctx.durationMs ?? null,
    exception: ctx.exception ? {
      error_type: ctx.exception.errorType || "UnknownError",
      error_code: ctx.exception.errorCode || "ERR_GENERAL",
      retryable: ctx.exception.retryable ?? false,
    } : null,
    metadata: redactSensitiveFields(ctx.metadata),
  };

  console.log(JSON.stringify(logEntry));
  return logEntry;
}
