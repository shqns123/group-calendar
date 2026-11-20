import { NextRequest, NextResponse } from "next/server";
import { ensureSignupDevice, readGoogleSignupIntent } from "@/lib/signupIdentity";
import { SIGNUP_INTENT_COOKIE } from "@/lib/signupPolicy";

export async function GET(req: NextRequest) {
  await ensureSignupDevice();
  const google = await readGoogleSignupIntent(req.cookies.get(SIGNUP_INTENT_COOKIE)?.value);
  return NextResponse.json({ google: google ? { name: google.name, email: google.email } : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SIGNUP_INTENT_COOKIE);
  return response;
}
