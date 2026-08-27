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
    <div className="mx-auto w-full max-w-2xl px-4 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My bookings</h1>
          {user && (
            <p className="text-sm text-zinc-500">Logged in as {user.email}</p>
          )}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            Log out
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">New booking</h2>
        <BookingForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Upcoming</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-zinc-500">No bookings yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex items-center justify-between py-3"
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
