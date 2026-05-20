import { encode } from "@auth/core/jwt";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

const MAX_AGE = 30 * 24 * 60 * 60;

async function verifyGoogleIdToken(idToken: string) {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Invalid Google ID token");
  const profile = await res.json();
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("Client ID mismatch");
  if (!profile.email_verified) throw new Error("Email not verified");
  return profile as { sub: string; email: string; name?: string; picture?: string };
}

async function makeSessionToken(userId: string, name: string | null, email: string | null, image: string | null, status: string, isOperator: boolean) {
  return encode({
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
    token: {
      sub: userId,
      name,
      email,
      picture: image,
      id: userId,
      status,
      isOperator,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    },
    maxAge: MAX_AGE,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.provider) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.provider === "google") {
    if (!body.idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    let profile: { sub: string; email: string; name?: string; picture?: string };
    try {
      profile = await verifyGoogleIdToken(body.idToken as string);
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error).message }, { status: 401 });
    }

    const isOperator = Boolean(
      process.env.OPERATOR_EMAIL &&
        profile.email.toLowerCase() === process.env.OPERATOR_EMAIL.toLowerCase(),
    );

    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    const dbUser = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: profile.name ?? existing.name,
            image: profile.picture ?? existing.image,
            isOperator: isOperator || existing.isOperator,
            status: isOperator ? "ACTIVE" : existing.status,
          },
        })
      : await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            image: profile.picture,
            status: isOperator ? "ACTIVE" : "PENDING",
            isOperator,
          },
        });

    if (!existing) {
      await prisma.account.upsert({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
        update: { userId: dbUser.id, type: "oauth" },
        create: { userId: dbUser.id, type: "oauth", provider: "google", providerAccountId: profile.sub },
      });
    }

    const sessionToken = await makeSessionToken(
      dbUser.id, dbUser.name, dbUser.email, dbUser.image, dbUser.status, dbUser.isOperator,
    );
    return NextResponse.json({ sessionToken, cookieName: COOKIE_NAME, pending: dbUser.status === "PENDING" });
  }

  if (body.provider === "guest") {
    const name = (body.name as string | undefined)?.trim();
    const employeeId = (body.employeeId as string | undefined)?.trim();
    if (!name || !employeeId) {
      return NextResponse.json({ error: "이름과 사번을 입력해 주세요." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { employeeId } });
    if (!dbUser || dbUser.name !== name || dbUser.status !== "ACTIVE") {
      return NextResponse.json({ error: "이름 또는 사번이 올바르지 않습니다." }, { status: 401 });
    }

    const sessionToken = await makeSessionToken(
      dbUser.id, dbUser.name, dbUser.email, dbUser.image, dbUser.status, dbUser.isOperator,
    );
    return NextResponse.json({ sessionToken, cookieName: COOKIE_NAME, pending: false });
  }

  return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
}
