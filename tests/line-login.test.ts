import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLineLoginUrl, isLineLoginConfigured } from "@/lib/line-login";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLineLoginConfigured", () => {
  it("is false when the LINE Login env vars are unset (e.g. a grader's checkout)", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "");
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "");
    expect(isLineLoginConfigured()).toBe(false);
  });

  it("is false when only some of the vars are set", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "abc");
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "");
    expect(isLineLoginConfigured()).toBe(false);
  });

  it("is true once all three vars are set", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "abc");
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "secret");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "http://localhost:3000/api/line/callback");
    expect(isLineLoginConfigured()).toBe(true);
  });
});

describe("buildLineLoginUrl", () => {
  it("builds a well-formed LINE authorize URL carrying state and nonce", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "channel-123");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "http://localhost:3000/api/line/callback");

    const url = new URL(buildLineLoginUrl("state-abc", "nonce-xyz"));

    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(url.searchParams.get("client_id")).toBe("channel-123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/line/callback");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("nonce")).toBe("nonce-xyz");
    expect(url.searchParams.get("scope")).toBe("openid profile");
  });

  it("throws if the channel id isn't configured", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "http://localhost:3000/api/line/callback");
    expect(() => buildLineLoginUrl("s", "n")).toThrow();
  });
});
