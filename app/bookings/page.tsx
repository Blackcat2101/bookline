import { verifySession, getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { BookingForm } from "@/app/bookings/booking-form";
import { CancelButton } from "@/app/bookings/cancel-button";

export default async function BookingsPage() {
  const { userId } = await verifySession();
  const user = await getCurrentUser();

  const bookings = await prisma.booking.findMany({
    where: { userId },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
          {user && (
            <p className="text-sm text-zinc-500">Logged in as {user.email}</p>
          )}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Log out
          </button>
        </form>
      </div>

      <section className="space-y-3 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm shadow-black/5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="text-lg font-medium">New booking</h2>
        <BookingForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Upcoming</h2>
        {bookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/15">
            No bookings yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 shadow-sm shadow-black/5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
              >
                <div>
                  <p className="font-medium">
                    {booking.startsAt.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {booking.note && (
                    <p className="text-sm text-zinc-500">{booking.note}</p>
                  )}
                </div>
                <CancelButton bookingId={booking.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
