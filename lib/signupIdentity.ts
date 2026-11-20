import "server-only";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { encode, decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { digestIdentifier, SIGNUP_DEVICE_COOKIE, SIGNUP_INTENT_COOKIE, SIGNUP_INTENT_SECONDS, signupIp, SignupError } from "./signupPolicy";

export type GoogleSignupProfile = { sub: string; email: string; name?: string; picture?: string };

function secret() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required for signup protection.");
  return process.env.AUTH_SECRET;
}

export function deviceCookieValue() {
  const id = randomBytes(24).toString("base64url");
  const mac = createHmac("sha256", secret()).update(id).digest("base64url");
  return `${id}.${mac}`;
}

function validDeviceCookie(value: string | undefined) {
  if (!value || value.length > 150) return false;
  const [id, mac, extra] = value.split(".");
  if (!id || !mac || extra || !/^[A-Za-z0-9_-]{32}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(mac)) return false;
  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  return mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

export async function ensureSignupDevice() {
  const jar = await cookies();
  if (!validDeviceCookie(jar.get(SIGNUP_DEVICE_COOKIE)?.value)) {
    jar.set(SIGNUP_DEVICE_COOKIE, deviceCookieValue(), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60,
    });
  }
}

export async function requestSignupIdentity(headers: Headers) {
  const jar = await cookies();
  const cookie = jar.get(SIGNUP_DEVICE_COOKIE)?.value;
  // Browser clients use a signed HttpOnly cookie. Native clients keep an installation ID.
  const nativeId = !headers.get("origin") && !headers.get("sec-fetch-site") ? headers.get("x-signup-device") : null;
  const device = nativeId && /^[A-Za-z0-9_-]{32,128}$/.test(nativeId) ? nativeId
    : validDeviceCookie(cookie) ? cookie! : null;
  if (!device) throw new SignupError("가입 화면을 새로 열어 다시 시도해 주세요.");
  return { device: digestIdentifier("device", device, secret()), ip: digestIdentifier("ip", signupIp(headers), secret()) };
}

export async function createGoogleSignupIntent(profile: GoogleSignupProfile) {
  return encode({ secret: secret(), salt: SIGNUP_INTENT_COOKIE, maxAge: SIGNUP_INTENT_SECONDS,
    token: { purpose: "signup", sub: profile.sub, email: profile.email.toLowerCase(), name: profile.name, picture: profile.picture } });
}

export async function readGoogleSignupIntent(raw: string | undefined) {
  if (!raw) return null;
  try {
    const data = await decode({ token: raw, secret: secret(), salt: SIGNUP_INTENT_COOKIE });
    if (data?.purpose !== "signup" || !data.sub || typeof data.email !== "string") return null;
    return { sub: data.sub, email: data.email, name: typeof data.name === "string" ? data.name : undefined,
      picture: typeof data.picture === "string" ? data.picture : undefined };
  } catch { return null; }
}

export async function saveGoogleSignupIntent(profile: GoogleSignupProfile) {
  const jar = await cookies();
  await ensureSignupDevice();
  jar.set(SIGNUP_INTENT_COOKIE, await createGoogleSignupIntent(profile), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SIGNUP_INTENT_SECONDS,
  });
}
