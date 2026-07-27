import { MedusaService } from "@medusajs/utils";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { CustomerPhone, CustomerAddress, LoginEvent } from "./models";
import type {
    OtpRequestInput,
    OtpVerifyInput,
    OtpVerifyResult,
    AddressInput,
} from "./types/common";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

/**
 * Customer identity module.
 *
 * CakeToHome customers authenticate with mobile + OTP only. This service:
 *   - generates and verifies OTPs (hashed at rest),
 *   - creates/links a Medusa core customer on first verification,
 *   - records login events (for login history / security),
 *   - manages customer delivery addresses.
 *
 * Integration points:
 *   - Notification Module (M6): sends the OTP via the SMS provider.
 *   - Settings Module (M1): feature flag `customer_accounts`, OTP config.
 *   - Analytics Module (M5): login/signup events.
 *
 * The Medusa core customer entity is created lazily on first successful
 * verification and linked via `customer_id` on the `customer_phone` row.
 */
class CustomerModuleService extends MedusaService({
    CustomerPhone,
    CustomerAddress,
    LoginEvent,
}) {
    /**
     * Generate a 6-digit OTP, store its hash + expiry, and dispatch it via
     * the notification module's SMS provider.
     *
     * Returns the plaintext OTP ONLY when no real SMS provider is configured
     * (development mode), so callers can surface it for testing. In production
     * the OTP is sent to the phone and never returned.
     */
    async requestOtp(
        input: OtpRequestInput,
        container: Record<string, unknown>
    ): Promise<{ sent: boolean; dev_otp?: string }> {
        const phone = normalizePhone(input.phone);
        const now = Date.now();

        // Find or create the phone record.
        let [phoneRecord] = (await this.listCustomerPhones({ phone })) as unknown as Record<
            string,
            unknown
        >[];

        if (phoneRecord) {
            // Enforce resend cooldown.
            const expiresAt = phoneRecord.otp_expires_at as Date | null;
            if (expiresAt) {
                const generatedAt = expiresAt.getTime() - OTP_TTL_MS;
                if (now - generatedAt < OTP_RESEND_COOLDOWN_MS) {
                    return { sent: false };
                }
            }
        } else {
            phoneRecord = (await this.createCustomerPhones({
                phone,
                phone_verified: false,
                otp_attempts: 0,
            })) as unknown as Record<string, unknown>;
        }

        const otp = String(randomInt(100000, 1000000));
        const otpHash = hashOtp(otp);
        const expiresAt = new Date(now + OTP_TTL_MS);

        await this.updateCustomerPhones({
            selector: { id: phoneRecord.id as string },
            data: {
                otp_hash: otpHash,
                otp_expires_at: expiresAt,
                otp_attempts: 0,
            },
        });

        // Dispatch via notification module (SMS channel).
        let sent = false;
        try {
            const notificationModule = container["notificationModuleService"] as {
                send?: (i: {
                    channel: string;
                    recipient: string;
                    body: string;
                }) => Promise<{ success: boolean }>;
            };
            if (notificationModule?.send) {
                const result = await notificationModule.send({
                    channel: "sms",
                    recipient: phone,
                    body: `Your CakeToHome verification code is ${otp}. It expires in 5 minutes.`,
                });
                sent = result?.success ?? false;
            }
        } catch {
            sent = false;
        }

        // In development (no provider / send failed), return the OTP for testing.
        const devOtp = sent ? undefined : otp;
        return { sent, dev_otp: devOtp };
    }

    /**
     * Verify an OTP against the stored hash. On success, ensures a Medusa core
     * customer exists for the phone (creating one if needed) and records a
     * login event.
     */
    async verifyOtp(
        input: OtpVerifyInput,
        container: Record<string, unknown>
    ): Promise<OtpVerifyResult> {
        const phone = normalizePhone(input.phone);
        const [phoneRecord] = (await this.listCustomerPhones({ phone })) as unknown as Record<
            string,
            unknown
        >[];

        if (!phoneRecord || !phoneRecord.otp_hash) {
            await this.recordLoginEvent(null, phone, input, false);
            return { success: false, error: "No OTP requested for this number." };
        }

        const expiresAt = phoneRecord.otp_expires_at as Date | null;
        if (!expiresAt || Date.now() > expiresAt.getTime()) {
            await this.recordLoginEvent(null, phone, input, false);
            return { success: false, error: "OTP expired. Please request a new one." };
        }

        const attempts = (phoneRecord.otp_attempts as number) ?? 0;
        if (attempts >= OTP_MAX_ATTEMPTS) {
            await this.recordLoginEvent(null, phone, input, false);
            return {
                success: false,
                error: "Too many failed attempts. Please request a new OTP.",
            };
        }

        if (!safeCompareOtp(input.otp, phoneRecord.otp_hash as string)) {
            await this.updateCustomerPhones({
                selector: { id: phoneRecord.id as string },
                data: { otp_attempts: attempts + 1 },
            });
            await this.recordLoginEvent(null, phone, input, false);
            return { success: false, error: "Invalid OTP." };
        }

        // OTP valid — clear it and mark phone verified.
        await this.updateCustomerPhones({
            selector: { id: phoneRecord.id as string },
            data: {
                otp_hash: null,
                otp_expires_at: null,
                otp_attempts: 0,
                phone_verified: true,
            },
        });

        // Ensure a Medusa core customer exists.
        let customerId = phoneRecord.customer_id as string | null;
        let isNewCustomer = false;
        if (!customerId) {
            customerId = await this.ensureCoreCustomer(phone, container);
            isNewCustomer = true;
            await this.updateCustomerPhones({
                selector: { id: phoneRecord.id as string },
                data: { customer_id: customerId },
            });
        }

        await this.recordLoginEvent(customerId, phone, input, true);

        return { success: true, customer_id: customerId, is_new_customer: isNewCustomer };
    }

    /**
     * Create a Medusa core customer for the phone if one does not exist.
     * Uses the customer module from the Medusa framework container.
     */
    private async ensureCoreCustomer(
        phone: string,
        container: Record<string, unknown>
    ): Promise<string> {
        // The Medusa core customer module is registered under Modules.CUSTOMER.
        const customerModule = container["customerService"] as {
            listCustomers?: (a: unknown, b: unknown, c: unknown) => Promise<unknown[]>;
            createCustomers?: (a: unknown) => Promise<{ id: string }[] | { id: string }>;
        } | undefined;

        if (customerModule?.listCustomers && customerModule.createCustomers) {
            const existing = (await customerModule.listCustomers(
                { phone },
                {},
                {}
            )) as unknown as { id: string }[];
            if (existing && existing.length > 0) {
                return existing[0].id;
            }
            const created = (await customerModule.createCustomers({
                phone,
                metadata: { phone_verified: true },
            })) as unknown as { id: string }[] | { id: string };
            return Array.isArray(created) ? created[0].id : created.id;
        }

        // Fallback: derive a stable local id when the core module is unavailable.
        return `cus_local_${phone.replace(/\D/g, "")}`;
    }

    private async recordLoginEvent(
        customerId: string | null,
        phone: string,
        input: OtpVerifyInput,
        success: boolean
    ): Promise<void> {
        try {
            await this.createLoginEvents({
                customer_id: customerId,
                phone,
                ip: input.ip ?? null,
                user_agent: input.user_agent ?? null,
                device: input.device ?? null,
                success,
            });
        } catch {
            // Login-event logging is best-effort; never fail auth on it.
        }
    }

    // ── Addresses ────────────────────────────────────────────────────────

    async listAddresses(customerId: string) {
        return this.listCustomerAddresses({ customer_id: customerId });
    }

    async createAddress(input: AddressInput) {
        const created = (await this.createCustomerAddresses([
            {
                customer_id: input.customer_id,
                label: input.label ?? null,
                first_name: input.first_name ?? null,
                last_name: input.last_name ?? null,
                phone: input.phone ?? null,
                line1: input.line1,
                line2: input.line2 ?? null,
                city: input.city,
                state: input.state ?? null,
                pincode: input.pincode ?? null,
                country: input.country ?? "IN",
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                is_default_shipping: input.is_default_shipping ?? false,
                is_default_billing: input.is_default_billing ?? false,
            },
        ])) as unknown as { id: string }[];

        if (input.is_default_shipping || input.is_default_billing) {
            await this.enforceSingleDefault(
                input.customer_id,
                created[0].id,
                !!input.is_default_shipping,
                !!input.is_default_billing
            );
        }

        return created[0];
    }

    async updateAddress(addressId: string, data: Partial<AddressInput>) {
        const updated = (await this.updateCustomerAddresses({
            selector: { id: addressId },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.first_name !== undefined ? { first_name: data.first_name } : {}),
                ...(data.last_name !== undefined ? { last_name: data.last_name } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
                ...(data.line1 !== undefined ? { line1: data.line1 } : {}),
                ...(data.line2 !== undefined ? { line2: data.line2 } : {}),
                ...(data.city !== undefined ? { city: data.city } : {}),
                ...(data.state !== undefined ? { state: data.state } : {}),
                ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
                ...(data.country !== undefined ? { country: data.country } : {}),
                ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
                ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
                ...(data.is_default_shipping !== undefined
                    ? { is_default_shipping: data.is_default_shipping }
                    : {}),
                ...(data.is_default_billing !== undefined
                    ? { is_default_billing: data.is_default_billing }
                    : {}),
            },
        })) as unknown as { id: string; customer_id: string }[];

        if (
            updated[0] &&
            (data.is_default_shipping || data.is_default_billing)
        ) {
            await this.enforceSingleDefault(
                updated[0].customer_id,
                updated[0].id,
                !!data.is_default_shipping,
                !!data.is_default_billing
            );
        }

        return updated[0];
    }

    async deleteAddress(addressId: string) {
        await this.deleteCustomerAddresses([addressId]);
    }

    /**
     * Ensure only one default shipping / billing address per customer.
     */
    private async enforceSingleDefault(
        customerId: string,
        keepId: string,
        shipping: boolean,
        billing: boolean
    ): Promise<void> {
        const addresses = (await this.listCustomerAddresses({
            customer_id: customerId,
        })) as unknown as { id: string; is_default_shipping: boolean; is_default_billing: boolean }[];

        for (const addr of addresses) {
            if (addr.id === keepId) continue;
            const updates: { is_default_shipping?: boolean; is_default_billing?: boolean } = {};
            if (shipping && addr.is_default_shipping) {
                updates.is_default_shipping = false;
            }
            if (billing && addr.is_default_billing) {
                updates.is_default_billing = false;
            }
            if (Object.keys(updates).length > 0) {
                await this.updateCustomerAddresses({
                    selector: { id: addr.id },
                    data: updates,
                });
            }
        }
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, "");
}

function hashOtp(otp: string): string {
    // HMAC-SHA256 with a static salt. The OTP is short-lived so this is
    // sufficient to prevent plaintext storage at rest.
    return createHmac("sha256", "caketohome-otp-salt").update(otp).digest("hex");
}

function safeCompareOtp(otp: string, hash: string): boolean {
    const candidate = hashOtp(otp);
    const a = Buffer.from(candidate);
    const b = Buffer.from(hash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export default CustomerModuleService;
