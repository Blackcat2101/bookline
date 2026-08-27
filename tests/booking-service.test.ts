import { afterAll, describe, expect, it } from "vitest";
import { createBookingForUser, cancelBookingForUser } from "@/lib/booking-service";
import { registerUser } from "@/lib/auth-service";
import { prisma } from "@/lib/db";

async function makeUser(name = "Test User") {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const result = await registerUser({ name, email, password: "password123" });
  if (!result.ok) throw new Error("test setup failed: could not register user");
  return result.userId;
}

function futureIso(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

describe("createBookingForUser", () => {
  it("creates a booking for a valid future time", async () => {
    const userId = await makeUser();
    const result = await createBookingForUser(userId, {
      startsAtRaw: futureIso(60),
      note: "hello",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a time in the past", async () => {
    const userId = await makeUser();
    const result = await createBookingForUser(userId, {
      startsAtRaw: futureIso(-60),
      note: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid date string", async () => {
    const userId = await makeUser();
    const result = await createBookingForUser(userId, {
      startsAtRaw: "not-a-date",
      note: "",
    });
    expect(result.ok).toBe(false);
  });

  it("prevents double-booking the same slot, even for a different user", async () => {
    const userA = await makeUser("Alice");
    const userB = await makeUser("Bob");
    const slot = futureIso(120);

    const first = await createBookingForUser(userA, { startsAtRaw: slot, note: "" });
    expect(first.ok).toBe(true);

    const second = await createBookingForUser(userB, { startsAtRaw: slot, note: "" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already booked/i);
  });
});

describe("cancelBookingForUser", () => {
  it("lets the owner cancel their own booking", async () => {
    const userId = await makeUser();
    const created = await createBookingForUser(userId, {
      startsAtRaw: futureIso(180),
      note: "",
    });
    if (!created.ok) throw new Error("test setup failed: could not create booking");

    const booking = await prisma.booking.findFirstOrThrow({
      where: { userId, startsAt: created.startsAt },
    });

    const result = await cancelBookingForUser(userId, booking.id);
    expect(result.ok).toBe(true);

    const stillThere = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(stillThere).toBeNull();
  });

  it("does not let another user cancel someone else's booking", async () => {
    const owner = await makeUser("Owner");
    const attacker = await makeUser("Attacker");
    const created = await createBookingForUser(owner, {
      startsAtRaw: futureIso(240),
      note: "",
    });
    if (!created.ok) throw new Error("test setup failed: could not create booking");

    const booking = await prisma.booking.findFirstOrThrow({
      where: { userId: owner, startsAt: created.startsAt },
    });

    const result = await cancelBookingForUser(attacker, booking.id);
    expect(result.ok).toBe(false);

    const stillThere = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(stillThere).not.toBeNull();
  });

  it("returns an error for a booking id that doesn't exist", async () => {
    const userId = await makeUser();
    const result = await cancelBookingForUser(userId, "does-not-exist");
    expect(result.ok).toBe(false);
  });

  it("frees the slot for another user to book after cancellation", async () => {
    const userA = await makeUser("Alice2");
    const userB = await makeUser("Bob2");
    const slot = futureIso(300);

    const created = await createBookingForUser(userA, { startsAtRaw: slot, note: "" });
    if (!created.ok) throw new Error("test setup failed: could not create booking");

    const booking = await prisma.booking.findFirstOrThrow({
      where: { userId: userA, startsAt: created.startsAt },
    });
    await cancelBookingForUser(userA, booking.id);

    const rebooked = await createBookingForUser(userB, { startsAtRaw: slot, note: "" });
    expect(rebooked.ok).toBe(true);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
