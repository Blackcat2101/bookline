import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (name.length < 2) {
    return { ok: false, error: "Name must be at least 2 characters." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true },
  });

  return { ok: true, userId: user.id };
}

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const genericError = { ok: false as const, error: "Invalid email or password." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return genericError;
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return genericError;
  }

  return { ok: true, userId: user.id };
}
