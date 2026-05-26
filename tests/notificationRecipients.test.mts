import test from "node:test";
import assert from "node:assert/strict";

import { filterNotifiableGroupMembers } from "../lib/notificationRecipients.ts";

test("observer members are excluded from notification recipients", () => {
  const members = [
    { id: "leader", role: "그룹장", status: "ACTIVE" },
    { id: "member", role: "MEMBER", status: "ACTIVE" },
    { id: "observer", role: "OBSERVER", status: "ACTIVE" },
    { id: "inactive", role: "MEMBER", status: "PENDING" },
  ];

  assert.deepEqual(
    filterNotifiableGroupMembers(members).map((member) => member.id),
    ["leader", "member"],
  );
});
