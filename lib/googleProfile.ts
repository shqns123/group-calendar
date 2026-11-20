import "server-only";
import type { GoogleSignupProfile } from "./signupIdentity";

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleSignupProfile> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Google 로그인 정보를 확인할 수 없습니다.");
  const profile = await response.json();
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID || !profile.sub || !profile.email ||
      (profile.email_verified !== true && profile.email_verified !== "true")) {
    throw new Error("유효하지 않은 Google 로그인 정보입니다.");
  }
  return { sub: profile.sub, email: profile.email.toLowerCase(), name: profile.name, picture: profile.picture };
}
