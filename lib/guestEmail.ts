import { randomBytes } from "node:crypto";

/**
 * Guest accounts have no real address, so they get a placeholder email. It used to be
 * `guest_<employeeId>@local.guest`, which showed every co-member the employee ID that guest
 * login checks. The local part is now random so the email says nothing about the account.
 */
export const GUEST_EMAIL_DOMAIN = "local.guest";

export function newGuestEmail() {
  return `guest_${randomBytes(12).toString("hex")}@${GUEST_EMAIL_DOMAIN}`;
}

/** True for the old placeholder that carried the employee ID. */
export function isLegacyGuestEmail(email: string | null, employeeId: string | null) {
  return !!email && !!employeeId && email === `guest_${employeeId}@${GUEST_EMAIL_DOMAIN}`;
}

type GuestEmailStore = {
  user: {
    findMany(args: {
      where: { email: { endsWith: string }; employeeId: { not: null } };
      select: { id: true; email: true; employeeId: true };
    }): Promise<{ id: string; email: string | null; employeeId: string | null }[]>;
    update(args: { where: { id: string }; data: { email: string } }): Promise<unknown>;
  };
};

/**
 * Gives every guest still on the old placeholder a random one. Safe to run on every start:
 * once moved, an account no longer matches. Returns how many accounts were moved.
 */
export async function migrateLegacyGuestEmails(db: GuestEmailStore) {
  const guests = await db.user.findMany({
    where: { email: { endsWith: `@${GUEST_EMAIL_DOMAIN}` }, employeeId: { not: null } },
    select: { id: true, email: true, employeeId: true },
  });
  let moved = 0;
  for (const guest of guests) {
    if (!isLegacyGuestEmail(guest.email, guest.employeeId)) continue;
    await db.user.update({ where: { id: guest.id }, data: { email: newGuestEmail() } });
    moved++;
  }
  return moved;
}
