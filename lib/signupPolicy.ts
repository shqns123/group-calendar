import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const SIGNUP_DEVICE_COOKIE = "gc-signup-device";
export const SIGNUP_INTENT_COOKIE = "gc-signup-intent";
export const SIGNUP_INTENT_SECONDS = 30 * 60;
export const QR_LIFETIME_MS = 60_000;
export const QR_LEASE_MS = 10_000;

export class SignupError extends Error {
  status: number;
  retryAfter: number;
  constructor(message: string, status = 400, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export type SignupIdentity = { device: string; ip: string };

export function digestIdentifier(kind: string, value: string, secret: string) {
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

export function normalizeIp(value: string | null): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw || !isIP(raw)) return null;
  if (raw.startsWith("::ffff:") && isIP(raw.slice(7)) === 4) return raw.slice(7);
  return isIP(raw) === 6 ? new URL(`http://[${raw}]`).hostname.slice(1, -1) : raw;
}

export function signupIp(headers: Headers) {
  // This header MUST be overwritten by the trusted reverse proxy (see README).
  const configured = process.env.SIGNUP_IP_HEADER?.trim();
  const raw = headers.get(configured || "x-forwarded-for");
  return normalizeIp(raw?.split(",")[0] ?? headers.get("x-real-ip")) ?? "unknown";
}

export function quotaRules(identity: SignupIdentity, phase: "attempt" | "signup", now: Date) {
  const rules = phase === "attempt"
    ? [{ kind: "device", id: identity.device, max: 5, duration: 10 * 60_000 },
       { kind: "ip", id: identity.ip, max: 20, duration: 10 * 60_000 }]
    : [{ kind: "device", id: identity.device, max: 1, duration: 24 * 60 * 60_000 },
       { kind: "ip", id: identity.ip, max: 10, duration: 60 * 60_000 }];
  return rules.map((rule) => ({ ...rule, key: `${phase}:${rule.kind}:${rule.id}`, now }));
}
