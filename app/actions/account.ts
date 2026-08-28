"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";

export async function disconnectLine() {
  const { userId } = await verifySession();
  await prisma.user.update({ where: { id: userId }, data: { lineUserId: null } });
  revalidatePath("/bookings");
}
