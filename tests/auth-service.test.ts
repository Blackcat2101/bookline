import { afterAll, describe, expect, it } from "vitest";
import { registerUser, loginUser } from "@/lib/auth-service";
import { prisma } from "@/lib/db";

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe("registerUser", () => {
  it("hashes the password and never stores it in plain text", async () => {
    const email = uniqueEmail();
    const result = await registerUser({ name: "Alice", email, password: "password123" });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe("password123");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail();
    await registerUser({ name: "Bob", email, password: "password123" });
    const second = await registerUser({ name: "Bob 2", email, password: "password123" });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already exists/i);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await registerUser({ name: "Carl", email: uniqueEmail(), password: "short" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid email address", async () => {
    const result = await registerUser({
      name: "Dan",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.ok).toBe(false);
  });
});

describe("loginUser", () => {
  it("succeeds with the correct password", async () => {
    const email = uniqueEmail();
    await registerUser({ name: "Eve", email, password: "correct-password" });

    const result = await loginUser({ email, password: "correct-password" });
    expect(result.ok).toBe(true);
  });

  it("fails with the wrong password", async () => {
    const email = uniqueEmail();
    await registerUser({ name: "Frank", email, password: "correct-password" });

    const result = await loginUser({ email, password: "wrong-password" });
    expect(result.ok).toBe(false);
  });

  it("gives the same generic error for a wrong password and a nonexistent account", async () => {
    const email = uniqueEmail();
    await registerUser({ name: "Grace", email, password: "correct-password" });

    const wrongPassword = await loginUser({ email, password: "wrong-password" });
    const noSuchAccount = await loginUser({ email: uniqueEmail(), password: "whatever123" });

    expect(wrongPassword.ok).toBe(false);
    expect(noSuchAccount.ok).toBe(false);
    if (!wrongPassword.ok && !noSuchAccount.ok) {
      expect(wrongPassword.error).toBe(noSuchAccount.error);
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
