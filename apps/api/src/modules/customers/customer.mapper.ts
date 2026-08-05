import { CustomerAuthPayload } from "./customer.types";

export class CustomerMapper {
  static toCustomerDTO(raw: any) {
    if (!raw) return null;
    return {
      id: raw.id,
      phone: raw.phone,
      email: raw.email || null,
      first_name: raw.first_name || null,
      last_name: raw.last_name || null,
      is_verified: Boolean(raw.is_verified),
      created_at: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
      addresses: Array.isArray(raw.addresses) ? raw.addresses.map(CustomerMapper.toAddressDTO) : [],
    };
  }

  static toAddressDTO(raw: any) {
    if (!raw) return null;
    return {
      id: raw.id,
      customer_id: raw.customer_id,
      label: raw.label || null,
      first_name: raw.first_name || null,
      last_name: raw.last_name || null,
      phone: raw.phone || null,
      line1: raw.line1,
      line2: raw.line2 || null,
      city: raw.city,
      state: raw.state || null,
      pincode: raw.pincode,
      country: raw.country || "IN",
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
      is_default_shipping: Boolean(raw.is_default_shipping),
      is_default_billing: Boolean(raw.is_default_billing),
    };
  }

  static toPhoneRecordDTO(raw: any) {
    if (!raw) return null;
    return {
      id: raw.id,
      phone: raw.phone,
      phone_verified: Boolean(raw.phone_verified),
      otp_hash: raw.otp_hash || null,
      otp_expires_at: raw.otp_expires_at ? new Date(raw.otp_expires_at) : null,
      otp_attempts: raw.otp_attempts || 0,
      customer_id: raw.customer_id || null,
    };
  }
}
