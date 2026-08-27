"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { sendLineMessage } from "@/lib/line";
import { createBookingForUser, cancelBookingForUser } from "@/lib/booking-service";

export type BookingFormState = { error: string } | { success: true } | undefined;

export async function createBooking(
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const { userId } = await verifySession();

  const result = await createBookingForUser(userId, {
    startsAtRaw: String(formData.get("startsAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/bookings");

  void sendLineMessage(
    `New booking confirmed for ${result.userName} on ${result.startsAt.toLocaleString(
      "en-US",
      { dateStyle: "medium", timeStyle: "short" }
    )}${result.note ? `\nNote: ${result.note}` : ""}`
  ).catch((err) => console.error("Failed to send LINE notification:", err));

  return { success: true };
}

export type CancelFormState = { error: string } | undefined;

export async function cancelBooking(
  _prevState: CancelFormState,
  formData: FormData
): Promise<CancelFormState> {
  const { userId } = await verifySession();
  const bookingId = String(formData.get("bookingId") ?? "");

  const result = await cancelBookingForUser(userId, bookingId);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/bookings");

  void sendLineMessage(
    `Booking cancelled for ${result.userName} on ${result.startsAt.toLocaleString(
      "en-US",
      { dateStyle: "medium", timeStyle: "short" }
    )}`
  ).catch((err) => console.error("Failed to send LINE notification:", err));

  return undefined;
}
