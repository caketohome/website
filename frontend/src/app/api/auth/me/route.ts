import { NextRequest, NextResponse } from "next/server";
import { retrieveUser } from "@/lib/data/users";
import { resolveServerSession } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = resolveServerSession(req);

    if (!session) {
      const response = NextResponse.json(
        {
          success: true,
          data: { user: null },
          message: "No active authenticated session found.",
        },
        { status: 200 }
      );
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }

    const { customerUid, userId, phone, role } = session;

    const { ApiEngine } = await import("@/lib/api-engine");
    const user = ApiEngine.resolveUserAccount({ userId, phone, role, customerUid }) || (await retrieveUser());

    if (!user) {
      const response = NextResponse.json(
        {
          success: true,
          data: { user: null },
          message: "No active authenticated session found.",
        },
        { status: 200 }
      );
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id || user.customer_uid,
            customer_uid: user.customer_uid || user.id,
            first_name: user.first_name || user.name?.split(" ")[0] || "Guest",
            last_name: user.last_name || user.name?.split(" ").slice(1).join(" ") || "",
            name: user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Valued Customer",
            email: user.email || "",
            phone: user.phone || "",
            role: (user.role || "CUSTOMER").toUpperCase(),
            branch_id: user.branch_id || user.primary_branch_id || null,
            branch_name: user.branch_name || user.primary_branch_name || null,
            delivery_partner_id: user.delivery_partner_id || null,
            partner_number: user.partner_number || null,
            profile_ids: user.profile_ids || [],
            profile_names: user.profile_names || [],
            permissions: user.permissions || [],
            date_of_birth: user.date_of_birth || user.dob || null,
            created_at: user.created_at || new Date().toISOString(),
          },
        },
      },
      { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve authenticated session",
      },
      { status: 500 }
    );
  }
}
