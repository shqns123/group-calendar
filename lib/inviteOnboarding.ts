/** Holds the claim of a group QR scanned before logging in, until the account exists (httpOnly). */
export const PENDING_QR_TOKEN_COOKIE_NAME = "group-calendar-pending-qr-token";

export function buildQrJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/join/qr/${encodeURIComponent(token)}`;
}
