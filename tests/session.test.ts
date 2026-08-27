import { describe, expect, it } from "vitest";
import { encrypt, decrypt } from "@/lib/session";

describe("session JWT", () => {
  it("round-trips a payload", async () => {
    const token = await encrypt({ userId: "abc123" });
    const payload = await decrypt(token);
    expect(payload?.userId).toBe("abc123");
  });

  it("rejects a tampered token", async () => {
    const token = await encrypt({ userId: "abc123" });
    const tampered = token.slice(0, -2) + (token.at(-2) === "a" ? "bb" : "aa");

    const payload = await decrypt(tampered);
    expect(payload).toBeNull();
  });

  it("returns null for an undefined token", async () => {
    const payload = await decrypt(undefined);
    expect(payload).toBeNull();
  });
});
