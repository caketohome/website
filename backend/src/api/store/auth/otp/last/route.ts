import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /store/auth/otp/last?phone=...
 * Development-only endpoint to retrieve the active OTP for testing.
 * SECURITY: Disabled in production.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found." });
  }

  const phone = (req.query.phone as string) || "";
  return res.status(200).json({
    phone,
    otp: "123456",
    message: "Development-only testing OTP endpoint. Disabled in production.",
  });
}
