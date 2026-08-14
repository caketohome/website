import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAMES = [
  "_cth_jwt",
  "_medusa_jwt",
  "_cth_role",
  "_cth_user_id",
  "_cth_phone",
  "_cth_branch_id",
  "_cth_shop_id",
  "_cth_partner_id",
  "_cth_cart_id",
  "_medusa_cart_id",
];

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const response = NextResponse.json(
    {
      success: true,
      message: "Logged out successfully. All sessions and credentials invalidated.",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );

  // Expire cookies via next/headers
  AUTH_COOKIE_NAMES.forEach((name) => {
    try {
      cookieStore.delete(name);
    } catch {
      // Ignore
    }
  });

  // Explicitly set expired Set-Cookie headers on response for maximum browser compatibility
  AUTH_COOKIE_NAMES.forEach((name) => {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: false,
      sameSite: "lax",
    });
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
