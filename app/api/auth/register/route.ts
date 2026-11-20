import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractQrToken } from "@/lib/qrInvite";
import { readGoogleSignupIntent, requestSignupIdentity } from "@/lib/signupIdentity";
import { SIGNUP_INTENT_COOKIE, SignupError } from "@/lib/signupPolicy";
import { recordSignupAttempt, registerInvitedUser } from "@/lib/signupService";
import { notifySignupOperators } from "@/lib/signupNotification";

export async function POST(req: NextRequest) {
  try {
    const identity = await requestSignupIdentity(req.headers);
    await recordSignupAttempt(prisma, identity);
    const body = await req.json().catch(() => null);
    const token = extractQrToken(body?.qrToken);
    if (!token) throw new SignupError("초대 QR 코드를 스캔해 주세요.");
    const isGoogle = body?.provider === "google" || typeof body?.signupToken === "string";
    const rawIntent = isGoogle ? (typeof body?.signupToken === "string" ? body.signupToken : req.cookies.get(SIGNUP_INTENT_COOKIE)?.value) : undefined;
    const google = await readGoogleSignupIntent(rawIntent);
    if (isGoogle && !google) throw new SignupError("Google 가입 정보가 만료됐어요. 다시 Google로 계속해 주세요.", 401);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
    if (!google && (!name || !employeeId || name.length > 20 || employeeId.length > 20)) {
      throw new SignupError("이름과 사번을 각각 20자 이내로 입력해 주세요.");
    }
    const pushToken = typeof body?.pushToken === "string" ? body.pushToken.trim() : undefined;
    if (pushToken && pushToken.length > 4096) throw new SignupError("알림 정보가 올바르지 않습니다.");
    const result = await registerInvitedUser(prisma, { identity, token, name, employeeId, google, pushToken });
    await notifySignupOperators(result.user.name ?? result.user.email ?? "사용자", result.groupName)
      .catch((error) => console.error("Signup notification failed", error));
    const response = NextResponse.json({ pending: true, groupName: result.groupName });
    response.cookies.delete(SIGNUP_INTENT_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof SignupError) return NextResponse.json({ error: error.message }, { status: error.status,
      headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "이미 등록된 계정이거나 사용된 초대입니다." }, { status: 409 });
    }
    console.error("Signup failed", error);
    return NextResponse.json({ error: "가입 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
