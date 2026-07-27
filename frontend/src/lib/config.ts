/**
 * CakeToHome Storefront API Configuration
 * Exports unified API client pointing to custom NestJS Core API (/api/v1).
 */

export { apiClient } from "./api-client";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000";
