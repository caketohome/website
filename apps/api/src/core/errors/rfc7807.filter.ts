/**
 * RFC 7807 Problem Details Error Formatting Service
 * Returns standardized error payloads: { type, title, status, detail, instance, errorCode, timestamp }
 */

export interface RFC7807ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errorCode: string;
  timestamp: string;
}

export class RFC7807ErrorFormatter {
  static formatError(
    status: number,
    title: string,
    detail: string,
    instancePath: string,
    errorCode = "INTERNAL_ERROR"
  ): RFC7807ProblemDetails {
    return {
      type: `https://caketohome.com/errors/${errorCode.toLowerCase()}`,
      title,
      status,
      detail,
      instance: instancePath,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }
}
