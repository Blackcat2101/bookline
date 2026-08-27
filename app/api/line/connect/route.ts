import { randomBytes } from "node:crypto";
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { buildLineLoginUrl, isLineLoginConfigured } from "@/lib/line-login";

export async function GET(request: NextRequest) {
  await verifySession();

  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(new URL("/bookings?line=unavailable", request.nextUrl));
  }

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set("line_oauth_state", state, cookieOptions);
  cookieStore.set("line_oauth_nonce", nonce, cookieOptions);

  return NextResponse.redirect(buildLineLoginUrl(state, nonce));
}
