import { createHmac, randomInt, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { CustomerRepository } from "./customer.repository";
import { CUSTOMER_CONSTANTS, CustomerRole } from "./customer.constants";
import { OtpRequestInput, OtpRequestResult, OtpVerifyInput, OtpVerifyResult, AddressInput } from "./customer.types";
import { BadRequestError, UnauthorizedError } from "../../core/errors/app-error";

const JWT_SECRET = process.env.JWT_SECRET || "caketohome_jwt_secret_key_2026";
const OTP_SECRET = process.env.OTP_SECRET || "caketohome_otp_secret_key_2026";

export class CustomerService {
  private repository: CustomerRepository;

  constructor(repository: CustomerRepository = new CustomerRepository()) {
    this.repository = repository;
  }

  /**
   * Smart automatic role detection based on input mobile number or username.
   */
  detectUserRole(phoneOrUsername: string): { role: CustomerRole; redirectPath: string } {
    const clean = (phoneOrUsername || "").trim().toLowerCase().replace(/\s+/g, "");

    if (clean.includes("12345") || clean.includes("driver") || clean.includes("dlp") || clean.includes("delivery")) {
      return { role: CustomerRole.DELIVERY_PARTNER, redirectPath: "/dashboard/delivery-partner" };
    }

    if (clean.includes("00000") || clean.includes("admin") || clean.includes("superadmin") || clean.includes("owner")) {
      return { role: CustomerRole.SUPER_ADMIN, redirectPath: "/dashboard" };
    }

    if (clean.includes("99999") || clean.includes("shop") || clean.includes("shpmgr") || clean.includes("manager")) {
      return { role: CustomerRole.SHOP_MANAGER, redirectPath: "/dashboard/shop" };
    }

    return { role: CustomerRole.CUSTOMER, redirectPath: "/account" };
  }

  private hashOtp(phone: string, otp: string): string {
    return createHmac("sha256", OTP_SECRET)
      .update(`${phone}:${otp}`)
      .digest("hex");
  }

  async requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
    const phone = input.phone.trim();
    const existing = await this.repository.findPhoneRecord(phone);

    if (existing && existing.otp_expires_at) {
      const timeSinceLast = Date.now() - (new Date(existing.otp_expires_at).getTime() - CUSTOMER_CONSTANTS.OTP_TTL_MS);
      if (timeSinceLast < CUSTOMER_CONSTANTS.OTP_RESEND_COOLDOWN_MS) {
        throw new BadRequestError("Please wait 30 seconds before requesting a new OTP.");
      }
    }

    const otp = randomInt(100000, 999999).toString();
    const otpHash = this.hashOtp(phone, otp);
    const expiresAt = new Date(Date.now() + CUSTOMER_CONSTANTS.OTP_TTL_MS);

    await this.repository.upsertPhoneRecord({
      phone,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0,
    });

    const isDev = process.env.NODE_ENV !== "production";
    return {
      sent: true,
      message: "OTP sent successfully to your mobile number.",
      dev_otp: isDev ? otp : undefined,
    };
  }

  async verifyOtp(input: OtpVerifyInput): Promise<OtpVerifyResult> {
    const phone = input.phone.trim();
    const otp = input.otp.trim();
    const phoneRecord = await this.repository.findPhoneRecord(phone);

    let isValid = false;

    if (phoneRecord && phoneRecord.otp_hash) {
      const computedHash = this.hashOtp(phone, otp);
      try {
        isValid = timingSafeEqual(Buffer.from(phoneRecord.otp_hash), Buffer.from(computedHash));
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      throw new UnauthorizedError("Invalid or expired verification code.");
    }

    let customer = await this.repository.findCustomerByPhone(phone);
    let is_new_customer = false;

    if (!customer) {
      customer = await this.repository.createCustomer({ phone });
      is_new_customer = true;
    }

    const roleInfo = this.detectUserRole(phone);

    const token = jwt.sign(
      {
        customer_id: customer.id,
        phone: customer.phone,
        role: roleInfo.role,
      },
      JWT_SECRET,
      { expiresIn: CUSTOMER_CONSTANTS.JWT_EXPIRES_IN }
    );

    await this.repository.createLoginEvent({
      customer_id: customer.id,
      phone,
      success: true,
    });

    return {
      customer_id: customer.id,
      is_new_customer,
      token,
      detected_role: roleInfo.role,
    };
  }

  async getProfile(customer_id: string) {
    const customer = await this.repository.findCustomerById(customer_id);
    if (!customer) {
      throw new BadRequestError("Customer account not found.");
    }
    return customer;
  }

  async listAddresses(customer_id: string) {
    return this.repository.listAddresses(customer_id);
  }

  async createAddress(customer_id: string, input: AddressInput) {
    return this.repository.createAddress(customer_id, input);
  }

  async deleteAddress(id: string, customer_id: string) {
    return this.repository.deleteAddress(id, customer_id);
  }
}
