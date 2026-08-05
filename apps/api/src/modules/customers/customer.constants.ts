export const CUSTOMER_CONSTANTS = {
  OTP_TTL_MS: 5 * 60 * 1000, // 5 minutes
  OTP_RESEND_COOLDOWN_MS: 30 * 1000, // 30 seconds
  OTP_MAX_ATTEMPTS: 5,
  JWT_EXPIRES_IN: "30d",
  DEFAULT_COUNTRY: "IN",
} as const;

export enum CustomerRole {
  CUSTOMER = "customer",
  SHOP_MANAGER = "shop",
  DELIVERY_PARTNER = "delivery_partner",
  SUPER_ADMIN = "admin",
}
