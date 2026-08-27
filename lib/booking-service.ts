import { prisma } from "@/lib/db";

export type CreateBookingResult =
  | {
      ok: true;
      startsAt: Date;
      note: string | null;
      userName: string;
      userLineUserId: string | null;
    }
  | { ok: false; error: string };

export async function createBookingForUser(
  userId: string,
  input: { startsAtRaw: string; note: string }
): Promise<CreateBookingResult> {
  const startsAt = new Date(input.startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Please choose a valid date and time." };
  }
  if (startsAt.getTime() <= Date.now()) {
    return { ok: false, error: "Please choose a time in the future." };
  }

  const note = input.note.trim();

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, lineUserId: true },
    });
    await prisma.booking.create({
      data: { startsAt, note: note || null, userId },
    });
    return {
      ok: true,
      startsAt,
      note: note || null,
      userName: user.name,
      userLineUserId: user.lineUserId,
    };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { ok: false, error: "That time slot is already booked. Please pick another." };
    }
    throw err;
  }
}

export type CancelBookingResult =
  | { ok: true; startsAt: Date; userName: string; userLineUserId: string | null }
  | { ok: false; error: string };

export async function cancelBookingForUser(
  userId: string,
  bookingId: string
): Promise<CancelBookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true,
      startsAt: true,
      user: { select: { name: true, lineUserId: true } },
    },
  });

  if (!booking || booking.userId !== userId) {
    return { ok: false, error: "Booking not found." };
  }

  await prisma.booking.delete({ where: { id: bookingId } });
  return {
    ok: true,
    startsAt: booking.startsAt,
    userName: booking.user.name,
    userLineUserId: booking.user.lineUserId,
  };
}
