export const PENDING_QR_TOKEN_COOKIE_NAME = "group-calendar-pending-qr-token";
export const PENDING_INVITE_COOKIE_NAME = "group-calendar-pending-invite-code";
export const PENDING_INVITE_STORAGE_KEY = "group-calendar.pending-invite-code";

export function extractInviteCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const inviteFromQuery =
      url.searchParams.get("inviteCode") ?? url.searchParams.get("invite");

    if (inviteFromQuery?.trim()) {
      return inviteFromQuery.trim();
    }
  } catch {
    // Plain invite code input is also valid.
  }

  return trimmed;
}

export function buildInviteJoinUrl(origin: string, inviteCode: string): string {
  return `${origin.replace(/\/$/, "")}/join/${encodeURIComponent(inviteCode)}`;
}

export function buildQrJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/join/qr/${encodeURIComponent(token)}`;
}
