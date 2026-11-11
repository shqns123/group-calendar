import { decode, encode, getToken, type JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieCandidates } from "@/lib/authCookies";

const PUBLIC_PATHS = [
  "/login",
  "/pending",
  "/join",
  "/api/auth",
  "/sw.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];
const PENDING_ALLOWED_PATHS = ["/pending", "/api/auth/status", "/api/auth/me"];

/**
 * Native app support: the mobile app sends the session JWT issued by
 * /api/auth/app-native-signin as `Authorization: Bearer <token>`.
 * We decode it, then forward it upstream as session cookies so every
 * existing route that calls `auth()` works unchanged.
 */
async function resolveBearerSession(request: NextRequest, cookieCandidates: string[]) {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  if (cookieCandidates.some((name) => request.cookies.has(name))) return null;

  const raw = header.slice(7).trim();
  const secret = process.env.AUTH_SECRET;
  if (!raw || !secret) return { token: null, headers: null };

  let payload: JWT | null = null;
  let issuedFor: string | null = null;
  for (const salt of cookieCandidates) {
    try {
      payload = await decode({ token: raw, secret, salt });
    } catch {
      payload = null;
    }
    if (payload?.sub) {
      issuedFor = salt;
      break;
    }
  }
  if (!payload?.sub) return { token: null, headers: null };

  // Keep the original expiry: re-encoding must never extend the session.
  const now = Math.floor(Date.now() / 1000);
  const remaining = typeof payload.exp === "number" ? payload.exp - now : 0;
  if (remaining <= 0) return { token: null, headers: null };

  // auth() picks the cookie name from the request protocol, and the cookie
  // name is also the JWE salt. Provide the token under every candidate name.
  const pairs = await Promise.all(
    cookieCandidates.map(async (name) => {
      const value =
        name === issuedFor ? raw : await encode({ token: payload!, secret, salt: name, maxAge: remaining });
      return `${name}=${value}`;
    }),
  );

  const headers = new Headers(request.headers);
  const existing = headers.get("cookie");
  headers.set("cookie", [existing, ...pairs].filter(Boolean).join("; "));
  return { token: payload, headers };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookieCandidates = getSessionCookieCandidates({
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });

  const bearer = await resolveBearerSession(request, cookieCandidates);
  const forward = () =>
    bearer?.headers ? NextResponse.next({ request: { headers: bearer.headers } }) : NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return forward();

  let token: JWT | null = bearer?.token ?? null;
  if (!bearer) {
    for (const cookieName of cookieCandidates) {
      token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
        cookieName,
        secureCookie: cookieName.startsWith("__Secure-"),
      });
      if (token?.sub) break;
    }
  }

  if (!token?.sub) {
    // App clients get JSON instead of an HTML login redirect.
    if (bearer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const status = token.status;
  if (
    status === "PENDING" &&
    !PENDING_ALLOWED_PATHS.some((path) => pathname.startsWith(path))
  ) {
    if (bearer) return NextResponse.json({ error: "Pending approval", status: "PENDING" }, { status: 403 });
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  return forward();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|guide.html|.*\\.png|.*\\.svg).*)",
  ],
};
