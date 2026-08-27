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
      <div className="flex-1 space-y-1.5">
        <label htmlFor="startsAt" className="text-sm font-medium">
          Date &amp; time
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          required
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={200}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Booking..." : "Book"}
      </button>
      {state && "error" in state && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:basis-full dark:bg-red-950/40 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:basis-full dark:bg-emerald-950/40 dark:text-emerald-400">
          Booking confirmed. A LINE notification was sent.
        </p>
      )}
    </form>
  );
}
