/**
 * CakeToHome Platform Kernel - Circuit Breaker & Resilience Service
 * Implements Circuit Breaker Pattern, Retry with Exponential Backoff, and Graceful Degradation.
 */

export enum CircuitState {
  CLOSED = "CLOSED", // Normal operations
  OPEN = "OPEN",     // Tripped - fail fast or fallback
  HALF_OPEN = "HALF_OPEN", // Testing recovery
}

export class CircuitBreakerService {
  private failureThreshold: number;
  private recoveryTimeMs: number;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(failureThreshold = 3, recoveryTimeMs = 10000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeMs = recoveryTimeMs;
  }

  async execute<T>(fn: () => Promise<T>, fallbackFn?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        if (fallbackFn) return fallbackFn();
        throw new Error("Circuit breaker is OPEN. Fast failing request.");
      }
    }

    try {
      const result = await fn();
      if (this.state === CircuitState.HALF_OPEN) {
        this.reset();
      }
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
      }
      if (fallbackFn) return fallbackFn();
      throw err;
    }
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  getState(): CircuitState {
    return this.state;
  }
}
