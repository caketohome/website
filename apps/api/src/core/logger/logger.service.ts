/**
 * CakeToHome Platform Kernel Logger Service
 * Structured JSON Logger with Request Correlation ID support.
 */

export class StructuredLogger {
  private contextName: string;

  constructor(contextName = "PlatformKernel") {
    this.contextName = contextName;
  }

  log(message: string, meta: Record<string, any> = {}) {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        context: this.contextName,
        message,
        ...meta,
      })
    );
  }

  error(message: string, stack?: string, meta: Record<string, any> = {}) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        context: this.contextName,
        message,
        stack,
        ...meta,
      })
    );
  }

  warn(message: string, meta: Record<string, any> = {}) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        context: this.contextName,
        message,
        ...meta,
      })
    );
  }
}
