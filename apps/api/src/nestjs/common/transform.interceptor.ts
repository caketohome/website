import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Request } from "express";
import { CORRELATION_ID_HEADER } from "./correlation-id.middleware";
import { ApiResponseEnvelope } from "./response.envelope";

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponseEnvelope<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || "system";

    return next.handle().pipe(
      map((data) => {
        // If data is already an envelope, return as-is
        if (data && typeof data === "object" && "success" in data && "meta" in data) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            correlationId,
            version: "1.0.0",
          },
        };
      })
    );
  }
}

