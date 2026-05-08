import { NextResponse, type NextRequest } from "next/server";

// NextAuth v5 cookie names. Both unprefixed (HTTP/dev) and prefixed
// (HTTPS/prod) variants. We delete bases unconditionally, plus iterate
// the request's actual cookies to catch chunked variants (.0, .1, ...)
// that NextAuth uses when the JWT exceeds the per-cookie size limit.
const COOKIE_BASES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.state",
  "__Secure-authjs.state",
  "authjs.nonce",
  "__Secure-authjs.nonce",
];

function expireCookie(
  res: NextResponse,
  name: string,
  isHttps: boolean,
): void {
  // Attributes (Path, SameSite, Secure) MUST match those used when the
  // cookie was originally set, or browsers ignore the deletion. NextAuth v5
  // sets session cookies HttpOnly + SameSite=lax + Path=/. Prefixed cookie
  // names (__Secure-, __Host-) require Secure.
  const isPrefixed = name.startsWith("__Secure-") || name.startsWith("__Host-");
  res.cookies.set({
    name,
    value: "",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps || isPrefixed,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const res = NextResponse.redirect(new URL("/login?signedout=1", req.url), 303);
  const isHttps = req.nextUrl.protocol === "https:";
  const seen = new Set<string>();

  // Delete all known base cookies unconditionally so a stale cookie not
  // sent on this request still gets a clearing header on the next visit.
  for (const base of COOKIE_BASES) {
    expireCookie(res, base, isHttps);
    seen.add(base);
  }

  // Also expire any chunked variants actually present on the request.
  for (const cookie of req.cookies.getAll()) {
    if (seen.has(cookie.name)) continue;
    const matches = COOKIE_BASES.some((base) =>
      cookie.name.startsWith(`${base}.`),
    );
    if (matches) {
      expireCookie(res, cookie.name, isHttps);
      seen.add(cookie.name);
    }
  }

  return res;
}
