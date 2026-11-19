import test from "node:test";
import assert from "node:assert/strict";

import { isLegacyGuestEmail, migrateLegacyGuestEmails, newGuestEmail } from "../lib/guestEmail.ts";

test("new guest emails are random and do not contain the employee ID", () => {
  const a = newGuestEmail();
  const b = newGuestEmail();
  assert.match(a, /^guest_[0-9a-f]{24}@local\.guest$/);
  assert.notEqual(a, b);
  assert.equal(isLegacyGuestEmail(a, "T-0001"), false);
});

test("recognises only the old employee-ID placeholder", () => {
  assert.equal(isLegacyGuestEmail("guest_T-0001@local.guest", "T-0001"), true);
  assert.equal(isLegacyGuestEmail("guest_T-0002@local.guest", "T-0001"), false);
  assert.equal(isLegacyGuestEmail("someone@gmail.com", "T-0001"), false);
  assert.equal(isLegacyGuestEmail(null, "T-0001"), false);
  assert.equal(isLegacyGuestEmail("guest_@local.guest", null), false);
});

test("moves only legacy guests, and a second run moves nothing", async () => {
  const users = [
    { id: "u1", email: "guest_T-0001@local.guest", employeeId: "T-0001" },
    { id: "u2", email: newGuestEmail(), employeeId: "T-0002" },
    { id: "u3", email: "guest_X@local.guest", employeeId: "T-0003" },
  ];
  const db = {
    user: {
      async findMany() {
        return users.filter((u) => u.email.endsWith("@local.guest") && u.employeeId !== null);
      },
      async update({ where, data }: { where: { id: string }; data: { email: string } }) {
        const user = users.find((u) => u.id === where.id)!;
        user.email = data.email;
        return user;
      },
    },
  };
  const untouched = [users[1].email, users[2].email];

  assert.equal(await migrateLegacyGuestEmails(db), 1);
  assert.match(users[0].email, /^guest_[0-9a-f]{24}@local\.guest$/);
  assert.equal(users[0].email.includes("T-0001"), false);
  assert.deepEqual([users[1].email, users[2].email], untouched);

  assert.equal(await migrateLegacyGuestEmails(db), 0);
});
