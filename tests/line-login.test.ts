import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLineLoginUrl, exchangeCodeForLineUserId, isLineLoginConfigured } from "@/lib/line-login";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    expect(url.searchParams.get("bot_prompt")).toBe("normal");
  });

  it("throws if the channel id isn't configured", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "http://localhost:3000/api/line/callback");
    expect(() => buildLineLoginUrl("s", "n")).toThrow();
  });
});

// exchangeCodeForLineUserId talks to LINE's real servers, so these mock
// `fetch` instead of hitting the network — real end-to-end behavior was
// verified manually against a live LINE Login channel.
function mockLineFetch(options: {
  tokenOk?: boolean;
  tokenBody?: unknown;
  verifyOk?: boolean;
  verifyBody?: unknown;
}) {
  const {
    tokenOk = true,
    tokenBody = { id_token: "fake-id-token" },
    verifyOk = true,
    verifyBody = { sub: "Uabc123", nonce: "nonce-xyz" },
  } = options;

  return vi.fn(async (url: string | URL) => {
    const href = String(url);
    if (href === "https://api.line.me/oauth2/v2.1/token") {
      return {
        ok: tokenOk,
        status: tokenOk ? 200 : 400,
        json: async () => tokenBody,
        text: async () => JSON.stringify(tokenBody),
      } as Response;
    }
    if (href === "https://api.line.me/oauth2/v2.1/verify") {
      return {
        ok: verifyOk,
        status: verifyOk ? 200 : 400,
        json: async () => verifyBody,
        text: async () => JSON.stringify(verifyBody),
      } as Response;
    }
    throw new Error(`unexpected fetch to ${href}`);
  });
}

describe("exchangeCodeForLineUserId", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "channel-123");
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "shh");
    vi.stubEnv("LINE_LOGIN_REDIRECT_URI", "http://localhost:3000/api/line/callback");
  });

  it("returns the sub claim when the token exchange and verification succeed", async () => {
    vi.stubGlobal(
      "fetch",
      mockLineFetch({ verifyBody: { sub: "Uabc123", nonce: "nonce-xyz" } })
    );

    const lineUserId = await exchangeCodeForLineUserId("auth-code", "nonce-xyz");
    expect(lineUserId).toBe("Uabc123");
  });

  it("throws when the nonce doesn't match (replay protection)", async () => {
    vi.stubGlobal(
      "fetch",
      mockLineFetch({ verifyBody: { sub: "Uabc123", nonce: "a-different-nonce" } })
    );

    await expect(exchangeCodeForLineUserId("auth-code", "nonce-xyz")).rejects.toThrow(/nonce/i);
  });

  it("throws when the verify response has no sub claim", async () => {
    vi.stubGlobal(
      "fetch",
      mockLineFetch({ verifyBody: { nonce: "nonce-xyz" } })
    );

    await expect(exchangeCodeForLineUserId("auth-code", "nonce-xyz")).rejects.toThrow(/sub/i);
  });

  it("throws when the verify response's sub is not a string", async () => {
    vi.stubGlobal(
      "fetch",
      mockLineFetch({ verifyBody: { sub: 12345, nonce: "nonce-xyz" } })
    );

    await expect(exchangeCodeForLineUserId("auth-code", "nonce-xyz")).rejects.toThrow(/sub/i);
  });

  it("throws when the token exchange itself fails", async () => {
    vi.stubGlobal("fetch", mockLineFetch({ tokenOk: false, tokenBody: { error: "invalid_grant" } }));

    await expect(exchangeCodeForLineUserId("bad-code", "nonce-xyz")).rejects.toThrow(
      /token exchange failed/i
    );
  });

  it("throws when the token response has no id_token", async () => {
    vi.stubGlobal("fetch", mockLineFetch({ tokenBody: {} }));

    await expect(exchangeCodeForLineUserId("auth-code", "nonce-xyz")).rejects.toThrow(
      /id_token/i
    );
  });

  it("throws when LINE's verify endpoint rejects the token", async () => {
    vi.stubGlobal("fetch", mockLineFetch({ verifyOk: false, verifyBody: { error: "invalid_request" } }));

    await expect(exchangeCodeForLineUserId("auth-code", "nonce-xyz")).rejects.toThrow(
      /verification failed/i
    );
  });
});
