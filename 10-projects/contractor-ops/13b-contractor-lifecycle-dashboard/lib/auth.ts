import { createSign } from "node:crypto";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = { token: string; expiresAt: number };
const cachedTokens: Record<string, CachedToken> = {};

export type SheetsScope = "read" | "write";
const SCOPES: Record<SheetsScope, string> = {
  read: "https://www.googleapis.com/auth/spreadsheets.readonly",
  write: "https://www.googleapis.com/auth/spreadsheets",
};

function loadKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SA_KEY_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SA_KEY_JSON is not set");
  }
  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SA_KEY_JSON is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SA_KEY_JSON missing client_email or private_key");
  }
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(key: ServiceAccountKey, scope: SheetsScope): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: SCOPES[scope],
    aud: key.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(payload),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key);
  return `${unsigned}.${b64url(signature)}`;
}

export async function getAccessToken(scope: SheetsScope = "read"): Promise<string> {
  const cached = cachedTokens[scope];
  if (cached && cached.expiresAt - 60 > Math.floor(Date.now() / 1000)) {
    return cached.token;
  }
  const key = loadKey();
  const jwt = signJwt(key, scope);
  const res = await fetch(key.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedTokens[scope] = {
    token: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
  return cachedTokens[scope].token;
}
