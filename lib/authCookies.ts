const SECURE_SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "__Secure-next-auth.session-token",
] as const;

const PLAIN_SESSION_COOKIES = [
  "authjs.session-token",
  "next-auth.session-token",
] as const;

type SessionCookieOptions = {
  protocol?: string | null;
  forwardedProto?: string | null;
};

export function isSecureAuthRequest(options: SessionCookieOptions): boolean {
  const forwardedProto = options.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return options.protocol === "https:";
}

export function getSessionCookieCandidates(options: SessionCookieOptions): string[] {
  const secure = isSecureAuthRequest(options);
  return secure
    ? [...SECURE_SESSION_COOKIES, ...PLAIN_SESSION_COOKIES]
    : [...PLAIN_SESSION_COOKIES, ...SECURE_SESSION_COOKIES];
}
