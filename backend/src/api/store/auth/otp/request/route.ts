import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { CUSTOMER_MODULE } from "../../../../../modules/customer";

const schema = zod.object({
    phone: zod.string().min(7).max(20),
});

/**
 * POST /store/auth/otp/request
 * Public endpoint. Generates an OTP for the given phone and dispatches it
 * via the notification SMS provider.
 *
 * In development (no SMS provider configured) the OTP is returned in
 * `dev_otp` so the storefront can display it for testing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid phone number.", errors: parsed.error.flatten() });
    }

    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        requestOtp: (
            input: { phone: string; ip?: string; user_agent?: string },
            container: Record<string, unknown>
        ) => Promise<{ sent: boolean; dev_otp?: string }>;
    };

    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
    const userAgent = req.headers["user-agent"] as string | undefined;

    const result = await customerModule.requestOtp(
        { phone: parsed.data.phone, ip, user_agent: userAgent },
        req.scope
    );

    return res.status(200).json({
        sent: result.sent,
        dev_otp: result.dev_otp,
        message: result.sent
            ? "OTP sent to your mobile number."
            : "OTP generated. Configure an SMS provider to send it.",
    });
}
