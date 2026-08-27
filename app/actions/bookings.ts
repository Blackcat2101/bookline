"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { sendLineMessage } from "@/lib/line";

export type BookingFormState = { error: string } | { success: true } | undefined;

export async function createBooking(
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const { userId } = await verifySession();

  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "Please choose a valid date and time." };
  }
  if (startsAt.getTime() <= Date.now()) {
    return { error: "Please choose a time in the future." };
  }

  let user;
  try {
    user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });
    await prisma.booking.create({
      data: {
        startsAt,
        note: note || null,
        userId,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { error: "That time slot is already booked. Please pick another." };
    }
    throw err;
  }

  revalidatePath("/bookings");

  void sendLineMessage(
    `New booking confirmed for ${user.name} on ${startsAt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })}${note ? `\nNote: ${note}` : ""}`
  ).catch((err) => console.error("Failed to send LINE notification:", err));

  return { success: true };
}

export async function cancelBooking(formData: FormData) {
  const { userId } = await verifySession();
  const bookingId = String(formData.get("bookingId") ?? "");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { userId: true },
  });

  if (!booking || booking.userId !== userId) {
    throw new Error("Booking not found.");
  }

  await prisma.booking.delete({ where: { id: bookingId } });
  revalidatePath("/bookings");
}
