import { execSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";

export async function setup() {
  const { parsed } = loadEnv({ path: path.resolve(__dirname, "../.env.test") });
  const env = { ...process.env, ...parsed };

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "inherit",
  });

  // Every test computes its own unique data, but startsAt is truncated to
  // the minute (matching the datetime-local input), so leftover rows from a
  // previous run can collide with this run's timestamps. Start each run
  // from a clean slate.
  const { PrismaClient } = await import("../app/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.booking.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}
