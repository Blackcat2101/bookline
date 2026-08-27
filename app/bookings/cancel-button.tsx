"use client";

import { useFormStatus } from "react-dom";
import { cancelBooking } from "@/app/actions/bookings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-red-600 underline disabled:opacity-50 dark:text-red-400"
    >
      {pending ? "Cancelling..." : "Cancel"}
    </button>
  );
}

export function CancelButton({ bookingId }: { bookingId: string }) {
  return (
    <form action={cancelBooking}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton />
    </form>
  );
}
