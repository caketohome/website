import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /admin/security/active-sessions
 * Admin — Retrieve list of active admin logins, locations, and agents.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  // Mock list of active sessions
  const sessions = [
    {
      id: "session_1",
      ip_address: req.ip || "127.0.0.1",
      user_agent: req.headers["user-agent"] || "Mozilla/5.0",
      last_active_at: new Date().toISOString(),
      is_current: true,
    },
    {
      id: "session_2",
      ip_address: "192.168.1.50",
      user_agent: "Chrome / Windows",
      last_active_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      is_current: false,
    },
  ];

  return res.status(200).json({ sessions });
}

/**
 * DELETE /admin/security/active-sessions/:id
 * Admin — Revoke / kill a specific login session.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  // Mock session deletion completion
  return res.status(200).json({ revoked: true });
}
