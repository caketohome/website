import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ message: "Token missing" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    response.cookies.set("_medusa_jwt", token, {
      httpOnly: true,
      secure: process.env.VERCEL_ENV === "production",
      expires: expiresAt,
      sameSite: "strict",
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
