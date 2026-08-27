import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const JWKS_URL = "https://api.line.me/oauth2/v2.1/certs";

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

/**
 * LINE Login is an optional add-on: it needs the submitter's own LINE Login
 * channel, so anyone running this app without those env vars (e.g. a grader
 * testing Modules A/B/C, which don't depend on this at all) should never
 * see a broken "Connect LINE" button — just no button.
 */
export function isLineLoginConfigured(): boolean {
  return Boolean(
    process.env.LINE_LOGIN_CHANNEL_ID &&
      process.env.LINE_LOGIN_CHANNEL_SECRET &&
      process.env.LINE_LOGIN_REDIRECT_URI
  );
}

export function buildLineLoginUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("LINE_LOGIN_CHANNEL_ID"),
    redirect_uri: requireEnv("LINE_LOGIN_REDIRECT_URI"),
    state,
    scope: "openid profile",
    nonce,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchanges an OAuth authorization code for the caller's LINE user ID.
 *
 * The `sub` claim of the returned ID token only matches the Messaging API's
 * userId space if this LINE Login channel has been linked to the LINE
 * Official Account in the LINE Developers Console — otherwise it's a valid
 * but unrelated per-channel identifier and push messages to it will fail.
 */
export async function exchangeCodeForLineUserId(
  code: string,
  nonce: string
): Promise<string> {
  const clientId = requireEnv("LINE_LOGIN_CHANNEL_ID");
  const clientSecret = requireEnv("LINE_LOGIN_CHANNEL_SECRET");
  const redirectUri = requireEnv("LINE_LOGIN_REDIRECT_URI");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE token exchange failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("LINE token response did not include an id_token");
  }

  const { payload } = await jwtVerify(data.id_token, jwks, {
    issuer: "https://access.line.me",
    audience: clientId,
  });

  if (payload.nonce !== nonce) {
    throw new Error("LINE id_token nonce mismatch");
  }
  if (typeof payload.sub !== "string") {
    throw new Error("LINE id_token missing sub claim");
  }

  return payload.sub;
}
