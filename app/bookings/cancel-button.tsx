"use client";

import { useActionState } from "react";
import { cancelBooking } from "@/app/actions/bookings";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelBooking, undefined);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {pending ? "Cancelling..." : "Cancel"}
      </button>
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
