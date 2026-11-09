export interface ApiResponseEnvelope<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    correlationId: string;
    version: string;
  };
}

export function createSuccessResponse<T>(data: T, correlationId: string = "system"): ApiResponseEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
      version: "1.0.0",
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  correlationId: string = "system"
): ApiResponseEnvelope<null> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
      version: "1.0.0",
    },
  };
}

