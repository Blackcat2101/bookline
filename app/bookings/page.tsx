import { verifySession, getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { BookingForm } from "@/app/bookings/booking-form";
import { CancelButton } from "@/app/bookings/cancel-button";
import { isLineLoginConfigured } from "@/lib/line-login";

export default async function BookingsPage(props: PageProps<"/bookings">) {
  const { userId } = await verifySession();
  const user = await getCurrentUser();
  const searchParams = await props.searchParams;
  const lineStatus = searchParams.line;
  const lineLoginAvailable = isLineLoginConfigured();

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

      {lineStatus === "connected" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          Your LINE account is connected. You&apos;ll get your own booking notifications from now on.
        </p>
      )}
      {lineStatus === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          Couldn&apos;t connect your LINE account. Please try again.
        </p>
      )}
      {lineStatus === "unavailable" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          LINE Login isn&apos;t configured on this server.
        </p>
      )}

      {(user?.lineUserId || lineLoginAvailable) && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/70 px-5 py-4 shadow-sm shadow-black/5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
          {user?.lineUserId ? (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ✓ LINE connected — you&apos;ll get your own booking notifications
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Connect LINE to get notified about your own bookings.
              </p>
              <a
                href="/api/line/connect"
                className="shrink-0 rounded-lg bg-[#06C755] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:brightness-95"
              >
                Connect LINE
              </a>
            </>
          )}
        </div>
      )}

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
