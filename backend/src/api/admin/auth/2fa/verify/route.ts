import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SECURITY_MODULE } from "../../../../../modules/security/service";

/**
 * POST /admin/auth/2fa/verify
 * Admin — Verify TOTP code and enable Two-Factor authentication.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id || "admin_1";
  const { code } = req.body as any;
  const securityService = req.scope.resolve(SECURITY_MODULE) as any;

  if (!code) {
    return res.status(400).json({ message: "Verification TOTP code is required." });
  }

  try {
    const [credentials] = await securityService.listUserTwoFactors({ user_id: actorId });
    if (!credentials) {
      return res.status(404).json({ message: "2FA is not setup for this user." });
    }

    const isValid = securityService.verifyTotp(credentials.secret, code);
    if (!isValid) {
      // Log event
      await securityService.recordFailedLogin(req.ip || "127.0.0.1", actorId);
      return res.status(400).json({ message: "Invalid verification code." });
    }

    // Enable 2FA
    await securityService.updateUserTwoFactors({
      id: credentials.id,
      is_enabled: true,
    });

    return res.status(200).json({ verified: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
