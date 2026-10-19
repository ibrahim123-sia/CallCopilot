import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Cloudflare Access guard (defence in depth). Access normally blocks unauthenticated visitors
 * before they reach the Worker; this check also blocks requests that bypass it (for example
 * the *.workers.dev URL). It is OFF unless CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are set,
 * so local development is unaffected.
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function middleware(req: NextRequest) {
  const team = process.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = process.env.CF_ACCESS_AUD;
  if (!team || !aud) return NextResponse.next();

  const token = req.headers.get("cf-access-jwt-assertion") ?? req.cookies.get("CF_Authorization")?.value;
  if (!token) return unauthorized();

  try {
    jwks ??= createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
    await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud });
    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

function unauthorized() {
  return new NextResponse("Unauthorized. Sign in through Cloudflare Access.", { status: 401 });
}

export const config = {
  // Everything except static build assets and the favicon
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
