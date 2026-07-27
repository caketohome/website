import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SECURITY_MODULE } from "../../../../../modules/security/service";

/**
 * POST /admin/auth/2fa/setup
 * Admin — Register or regenerate TOTP 2FA secret credentials.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id || "admin_1";
  const securityService = req.scope.resolve(SECURITY_MODULE) as any;

  try {
    const { secret, qrCodeUrl } = securityService.generateTotpSecret(actorId);

    // Write / update Two-Factor credentials
    const [existing] = await securityService.listUserTwoFactors({ user_id: actorId });
    if (existing) {
      await securityService.updateUserTwoFactors({
        id: existing.id,
        secret,
        is_enabled: false, // Wait until verified to enable
      });
    } else {
      await securityService.createUserTwoFactors([
        {
          user_id: actorId,
          secret,
          is_enabled: false,
          recovery_codes: JSON.stringify(["rec123", "rec456"]),
        },
      ]);
    }

    return res.status(200).json({ secret, qrCodeUrl });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
