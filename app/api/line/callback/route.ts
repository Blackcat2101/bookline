import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { exchangeCodeForLineUserId } from "@/lib/line-login";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { userId } = await verifySession();

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("line_oauth_state")?.value;
  const nonce = cookieStore.get("line_oauth_nonce")?.value;
  cookieStore.delete("line_oauth_state");
  cookieStore.delete("line_oauth_nonce");

  const redirectWithStatus = (status: "connected" | "error") =>
    NextResponse.redirect(new URL(`/bookings?line=${status}`, request.nextUrl));

  if (errorParam || !code || !state || !nonce || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    const lineUserId = await exchangeCodeForLineUserId(code, nonce);

    const existing = await prisma.user.findUnique({ where: { lineUserId } });
    if (existing && existing.id !== userId) {
      // Already linked to a different BookLine account.
      return redirectWithStatus("error");
    }

    await prisma.user.update({ where: { id: userId }, data: { lineUserId } });
    return redirectWithStatus("connected");
  } catch (err) {
    console.error("LINE Login callback failed:", err);
    return redirectWithStatus("error");
  }
}
