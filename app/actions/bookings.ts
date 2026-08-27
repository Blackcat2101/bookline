"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { pushLineMessage, sendLineMessage } from "@/lib/line";
import { createBookingForUser, cancelBookingForUser } from "@/lib/booking-service";

export type BookingFormState =
  | { error: string }
  | { success: true; adminNotified: boolean; userNotified: boolean | null }
  | undefined;

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

  const when = result.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const adminNotified = await sendLineMessage(
    `New booking confirmed for ${result.userName} on ${when}${
      result.note ? `\nNote: ${result.note}` : ""
    }`
  );

  const userNotified = result.userLineUserId
    ? await pushLineMessage(
        result.userLineUserId,
        `Your booking is confirmed for ${when}.${result.note ? `\nNote: ${result.note}` : ""}`
      )
    : null;

  return { success: true, adminNotified, userNotified };
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

  const when = result.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  void sendLineMessage(`Booking cancelled for ${result.userName} on ${when}`);

  if (result.userLineUserId) {
    void pushLineMessage(result.userLineUserId, `Your booking for ${when} has been cancelled.`);
  }

  return undefined;
}
