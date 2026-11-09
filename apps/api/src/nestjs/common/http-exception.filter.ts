import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { CORRELATION_ID_HEADER } from "./correlation-id.middleware";
import { createErrorResponse } from "./response.envelope";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || "system";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An unexpected server error occurred";
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        message = (res as any).message || message;
        code = (res as any).error || `HTTP_${status}`;
        details = (res as any).details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || "UNHANDLED_ERROR";
    }

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    const errorPayload = createErrorResponse(code, message, details, correlationId);
    response.status(status).json(errorPayload);
  }
}

