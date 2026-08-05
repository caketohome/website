import { Request, Response, NextFunction } from "express";
import { AppError } from "../core/errors/app-error";
import { StructuredLogger } from "../core/logger/logger.service";

const logger = new StructuredLogger("ErrorHandler");

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  logger.error("Unhandled Exception caught in Express middleware", err.stack || String(err), {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "An internal server error occurred." : err.message || "Unknown error",
      details: [],
    },
  });
}
