import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SESSION_COOKIE_CANDIDATES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export async function GET(request: NextRequest) {
  const redirectUri = request.nextUrl.searchParams.get("redirect_uri");
  const fallbackUrl = new URL("/login", request.url);

  if (!redirectUri) {
    fallbackUrl.searchParams.set("error", "missing_redirect_uri");
    return NextResponse.redirect(fallbackUrl);
  }

  let appUrl: URL;
  try {
    appUrl = new URL(redirectUri);
  } catch {
    fallbackUrl.searchParams.set("error", "invalid_redirect_uri");
    return NextResponse.redirect(fallbackUrl);
  }

  const session = await auth();
  if (!session?.user?.id) {
    appUrl.searchParams.set("error", "missing_session");
    return NextResponse.redirect(appUrl);
  }

  const cookieName = SESSION_COOKIE_CANDIDATES.find((name) =>
    request.cookies.has(name),
  );
  const sessionToken = cookieName ? request.cookies.get(cookieName)?.value : null;

  if (!cookieName || !sessionToken) {
    appUrl.searchParams.set("error", "missing_session_token");
    return NextResponse.redirect(appUrl);
  }

  appUrl.searchParams.set("sessionToken", sessionToken);
  appUrl.searchParams.set("cookieName", cookieName);

  return NextResponse.redirect(appUrl);
}
