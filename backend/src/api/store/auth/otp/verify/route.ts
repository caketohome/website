import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { CUSTOMER_MODULE } from "../../../../../modules/customer";

const schema = zod.object({
    phone: zod.string().min(7).max(20),
    otp: zod.string().length(6),
});

/**
 * POST /store/auth/otp/verify
 * Public endpoint. Verifies the OTP and returns the customer_id.
 *
 * The storefront is responsible for issuing/persisting the auth session
 * (e.g. via the Medusa auth cookie). This endpoint confirms identity only.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request.", errors: parsed.error.flatten() });
    }

    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        verifyOtp: (
            input: {
                phone: string;
                otp: string;
                ip?: string;
                user_agent?: string;
                device?: string;
            },
            container: Record<string, unknown>
        ) => Promise<{
            success: boolean;
            customer_id?: string;
            is_new_customer?: boolean;
            error?: string;
        }>;
    };

    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
    const userAgent = req.headers["user-agent"] as string | undefined;

    const result = await customerModule.verifyOtp(
        { phone: parsed.data.phone, otp: parsed.data.otp, ip, user_agent: userAgent },
        req.scope
    );

    if (!result.success) {
        return res.status(401).json({ message: result.error ?? "Verification failed." });
    }

    // Generate JWT token for customer authentication compatibility
    const jwt = require("jsonwebtoken");
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: "Server configuration error: JWT_SECRET not set" });
    }
    const token = jwt.sign(
        {
            actor_id: result.customer_id,
            actor_type: "customer",
        },
        jwtSecret,
        {
            expiresIn: "7d",
        }
    );

    return res.status(200).json({
        customer_id: result.customer_id,
        is_new_customer: result.is_new_customer ?? false,
        token,
    });
}

