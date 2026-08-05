import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../../core/errors/app-error";

const JWT_SECRET = process.env.JWT_SECRET || "caketohome_jwt_secret_key_2026";

export interface AuthenticatedRequest extends Request {
  user?: {
    customer_id: string;
    phone: string;
    role: string;
  };
}

export function customerAuthGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token is required."));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      customer_id: decoded.customer_id,
      phone: decoded.phone,
      role: decoded.role || "customer",
    };
    return next();
  } catch {
    return next(new UnauthorizedError("Invalid or expired authentication token."));
  }
}
