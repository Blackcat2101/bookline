"use client";

import { useActionState, useRef, useEffect } from "react";
import { createBooking } from "@/app/actions/bookings";

export function BookingForm() {
  const [state, action, pending] = useActionState(createBooking, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label htmlFor="startsAt" className="text-sm font-medium">
          Date &amp; time
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          required
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20"
        />
      </div>
      <div className="flex-1 space-y-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={200}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Booking..." : "Book"}
      </button>
      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400 sm:basis-full">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-green-600 dark:text-green-400 sm:basis-full">
          Booking confirmed. A LINE notification was sent.
        </p>
      )}
    </form>
  );
}
