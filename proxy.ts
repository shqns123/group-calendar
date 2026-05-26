import { getToken } from "next-auth/jwt";
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
const PENDING_ALLOWED_PATHS = ["/pending", "/api/auth/status"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const cookieCandidates = getSessionCookieCandidates({
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });

  let token = null;
  for (const cookieName of cookieCandidates) {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName,
      secureCookie: cookieName.startsWith("__Secure-"),
    });
    if (token?.sub) break;
  }

  if (!token?.sub) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const status = token.status;
  if (
    status === "PENDING" &&
    !PENDING_ALLOWED_PATHS.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|guide.html|.*\\.png|.*\\.svg).*)",
  ],
};
