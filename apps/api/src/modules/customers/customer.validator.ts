import { BadRequestError } from "../../core/errors/app-error";

export function validateOtpRequest(body: any) {
  if (!body || typeof body.phone !== "string" || body.phone.trim().length < 3) {
    throw new BadRequestError("Valid phone number or username is required.");
  }
  return { phone: body.phone.trim() };
}

export function validateOtpVerify(body: any) {
  if (!body || typeof body.phone !== "string" || body.phone.trim().length < 3) {
    throw new BadRequestError("Valid phone number or username is required.");
  }
  if (!body.otp || typeof body.otp !== "string" || body.otp.trim().length < 4) {
    throw new BadRequestError("Valid 6-digit OTP code is required.");
  }
  return {
    phone: body.phone.trim(),
    otp: body.otp.trim(),
  };
}

export function validateAddressInput(body: any) {
  if (!body || typeof body.line1 !== "string" || !body.line1.trim()) {
    throw new BadRequestError("Address Line 1 is required.");
  }
  if (typeof body.city !== "string" || !body.city.trim()) {
    throw new BadRequestError("City is required.");
  }
  if (typeof body.pincode !== "string" || !body.pincode.trim()) {
    throw new BadRequestError("Pincode is required.");
  }
  return {
    label: body.label?.trim(),
    first_name: body.first_name?.trim(),
    last_name: body.last_name?.trim(),
    phone: body.phone?.trim(),
    line1: body.line1.trim(),
    line2: body.line2?.trim(),
    city: body.city.trim(),
    state: body.state?.trim(),
    pincode: body.pincode.trim(),
    country: body.country?.trim() || "IN",
    latitude: typeof body.latitude === "number" ? body.latitude : undefined,
    longitude: typeof body.longitude === "number" ? body.longitude : undefined,
    is_default_shipping: Boolean(body.is_default_shipping),
    is_default_billing: Boolean(body.is_default_billing),
  };
}
