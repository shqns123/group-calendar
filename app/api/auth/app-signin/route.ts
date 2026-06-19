import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

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

  const callbackUrl = new URL("/api/auth/app-callback", request.url);
  callbackUrl.searchParams.set("redirect_uri", appUrl.toString());

  return signIn("google", { redirectTo: callbackUrl.toString() });
}
