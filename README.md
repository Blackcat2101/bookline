# BookLine

A take-home assignment: login, appointment booking with double-booking prevention, and a real LINE
push notification on successful booking.

## Tech stack & why

- **Next.js 16 (App Router) + React 19** — already scaffolded in this repo, and its Server Actions
  let forms mutate data directly on the server without hand-rolling a separate REST/JSON API. Fewer
  moving parts for a 2-day build.
- **PostgreSQL + Prisma** — a real relational database gives a `UNIQUE` constraint on the booking
  slot "for free," which is the simplest and most reliable way to guarantee no double-booking, even
  under concurrent requests (a race between two `SELECT`-then-`INSERT` calls in application code
  would not be safe).
- **jose (JWT) in an httpOnly cookie** — chosen over a database-backed session table for simplicity
  and to avoid extra infra. The JWT payload only holds the user's id, is signed (not just encoded),
  and the cookie is `httpOnly`, `sameSite: lax`, and `secure` in production, so it can't be read or
  forged from client JS and isn't sent cross-site. The tradeoff versus DB sessions: a token can't be
  revoked before it expires (7 days here). For this assignment's scope that tradeoff is acceptable;
  a real product would likely reach for a maintained auth library (NextAuth/Better Auth) or add a
  session table.
- **bcryptjs** for password hashing (cost factor 10) — passwords are never stored or logged in
  plain text.
- **LINE Messaging API (Push Message)** — called server-side, after the booking row is committed to
  the database, with the channel access token kept server-only in an env var.

## Project structure

```
app/
  actions/auth.ts        Server Actions: register, login, logout (thin wrappers)
  actions/bookings.ts     Server Actions: createBooking, cancelBooking (thin wrappers)
  login/, register/       Auth pages (client forms + useActionState)
  bookings/                Protected page: list, create, cancel bookings
lib/
  auth-service.ts          registerUser/loginUser — testable business logic, no Next APIs
  booking-service.ts        createBookingForUser/cancelBookingForUser — same
  db.ts                     Prisma client singleton
  session.ts                 JWT sign/verify + cookie helpers
  dal.ts                     verifySession()/getCurrentUser() — the "data access layer"
  line.ts                     LINE push notification helper
proxy.ts                     Route protection (Next 16's replacement for middleware.ts)
prisma/schema.prisma         User, Booking models
tests/                        Vitest suite (see Testing below)
```

The Server Actions in `app/actions/` only handle web-specific concerns (reading `FormData`,
session cookies, `redirect()`, cache revalidation, firing the LINE push). The actual rules —
password hashing, duplicate-email checks, double-booking rejection, ownership checks — live in
`lib/auth-service.ts` and `lib/booking-service.ts`, which depend on nothing but Prisma. That split
is what makes them testable without spinning up a full Next.js request context.

## Setup & run

Prerequisites: Node 20+, Docker (for local Postgres) or any reachable Postgres instance.

```bash
npm install

# start a local Postgres (see docker-compose.yml)
docker compose up -d

# copy env vars and fill them in (see below)
cp .env.example .env

# create the database schema
npx prisma migrate dev --name init

npm run dev
```

Open http://localhost:3000 — it redirects to `/login`. Register an account, log in, and book a slot.

## Testing

```bash
npm test
```

Runs the Vitest suite in `tests/` against a separate `bookline_test` database (created once with
`docker exec <container> psql -U postgres -c "CREATE DATABASE bookline_test"`, connection string in
`.env.test`). A Vitest global setup applies the Prisma migrations and truncates the tables before
each run, so it's safe to re-run repeatedly and never touches your dev data in `bookline`.

Covers the rules that actually matter for correctness and security: passwords are hashed and never
stored in plain text, duplicate emails and short passwords are rejected, login gives the same
generic error for a wrong password as for a nonexistent account, a slot can't be double-booked even
across two different users, a user can't cancel someone else's booking, and a cancelled slot is
free for anyone to rebook. Also covers the session JWT round-trip and tampering rejection.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Matches `docker-compose.yml` by default. |
| `JWT_SECRET` | Random secret used to sign session JWTs. Generate with `openssl rand -base64 32`. |
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived channel access token for a LINE Messaging API channel (LINE Developers Console → your channel → Messaging API tab). |
| `LINE_USER_ID` | The `userId` that should receive the push notification. Add your LINE Official Account as a friend, then grab your own `userId` (e.g. from a webhook log, or the "test" target in the Developers Console). |

## Key design decisions

- **Booking model is a single shared calendar.** `Booking.startsAt` has a database-level `UNIQUE`
  constraint, so *any* user booking the same date/time as an existing booking gets rejected — this
  is what the brief means by "prevent double-booking the same date/time slot," and enforcing it at
  the DB layer (not just an application-level check-then-insert) avoids a race condition between two
  simultaneous requests for the same slot.
- **Cancelling deletes the row.** This keeps the unique constraint simple (a cancelled slot is
  immediately free again) at the cost of not keeping a cancellation history. Given the brief's
  "data structure is up to the candidate" and 2-day scope, I chose the simpler option.
- **Route protection has two layers:** `proxy.ts` does an optimistic redirect for `/bookings` based
  on the JWT cookie (fast, but only a UX nicety), and every Server Action independently calls
  `verifySession()` before touching the database — so the real authorization check happens
  server-side, next to the data, not just at the edge.
- **Ownership check on cancel:** `cancelBookingForUser` loads the booking, confirms `booking.userId`
  matches the session's `userId`, and only then deletes — a user cannot cancel someone else's
  booking by guessing/tampering with a booking id. Rather than throwing (which would render Next's
  generic error page), it returns a typed result so the failure shows as an ordinary inline form
  error, the same way a validation error does anywhere else in the app.
- **LINE notification is best-effort, not transactional.** The booking is committed to the database
  first; the LINE push is fired afterward and its failure is only logged, not surfaced as a booking
  failure. This mirrors a hard requirement in the brief that a real send is required, while
  guaranteeing the core booking flow doesn't break because of a third-party API problem — that
  design tradeoff is intentional. (Proof of the notification firing: see the screenshot/clip
  submitted alongside this repo.)
- **Timezone:** the `datetime-local` input and `new Date(...)` parsing assume the browser and server
  share a timezone. For a real product this would need an explicit timezone (store UTC, format in
  the user's locale).

## What's left unfinished

- No password reset / email verification flow.
- No pagination on the booking list (fine at this scale).
- No rate limiting on login/register.
- Test coverage is at the service layer (business rules), not end-to-end through the HTTP/Server
  Action layer or the UI — those were verified manually during development instead.
- Session JWTs can't be revoked before their 7-day expiry (no server-side session table/blocklist).
