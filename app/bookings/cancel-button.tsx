"use client";

import { useFormStatus } from "react-dom";
import { cancelBooking } from "@/app/actions/bookings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
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
