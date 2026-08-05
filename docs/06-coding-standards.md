# 06 — Coding Standards

## TypeScript & Compiler Standards

* **Strict Mode Enabled**: `"strict": true` in `tsconfig.json`.
* **No Explicit Any**: Avoid `any` types; define explicit DTO types or generics.
* **Async / Await**: Always use `async/await` rather than raw Promise callbacks.

---

## Custom Exception Hierarchy

All domain exceptions MUST extend the base `AppError` class to ensure consistent HTTP error responses:

```typescript
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_SERVER_ERROR",
    public readonly details: any[] = []
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", details: any[] = []) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource Not Found") {
    super(message, 404, "NOT_FOUND");
  }
}
```

---

## Structured Logging Standard

All modules must log using the centralized `StructuredLogger` outputting JSON logs with contextual metadata:

```typescript
logger.info("OTP requested for customer", {
  phone: "+919876543210",
  context: "AuthModule",
  ip: req.ip,
});
```
