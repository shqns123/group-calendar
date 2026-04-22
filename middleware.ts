import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/pending", "/api/auth", "/sw.js", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // PENDING 유저는 /pending으로 강제 이동
  const status = (session.user as Record<string, unknown>).status;
  if (status === "PENDING") {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|guide.html|.*\\.png|.*\\.svg).*)",
  ],
};
