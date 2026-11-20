import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { recordSignupAttempt, registerInvitedUser } from "../lib/signupService.ts";
import { digestIdentifier, normalizeIp, QR_LIFETIME_MS, SignupError, signupIp } from "../lib/signupPolicy.ts";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const schema = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
assert.equal(schema.status, 0, schema.stderr);
const now = new Date("2026-11-20T03:00:00Z");

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = mkdtempSync(path.join(tmpdir(), "calendar-signup-"));
  const filename = path.join(dir, "test.db");
  const sqlite = new Database(filename);
  sqlite.exec(schema.stdout);
  sqlite.close();
  const db = new PrismaClient({ datasourceUrl: `file:${filename.replaceAll("\\", "/")}` });
  t.after(async () => {
    await db.$disconnect();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith("calendar-signup-"));
    rmSync(dir, { recursive: true, force: true });
  });
  const inviter = await db.user.create({ data: { name: "초대자", email: `${randomUUID()}@example.test`, status: "ACTIVE", isOperator: true } });
  const group = await db.group.create({ data: { name: "테스트 그룹", leaderId: inviter.id } });
  const qr = async (overrides = {}) => db.qrInviteToken.create({ data: { token: randomUUID(), groupId: group.id, createdById: inviter.id,
    expiresAt: new Date(now.getTime() + QR_LIFETIME_MS), leaseUntil: new Date(now.getTime() + 10_000), autoApprove: true, ...overrides } });
  const signup = async (token: string, device: string = randomUUID(), ip: string = randomUUID(), extra = {}, at = now) => registerInvitedUser(db,
    { token, identity: { device, ip }, name: "신규 회원", employeeId: randomUUID(), ...extra }, at);
  return { db, inviter, group, qr, signup, filename };
}

function rejected(status: number) {
  return (error: unknown) => error instanceof SignupError && error.status === status;
}

test("a live QR creates one verified pending account, never an active account", async (t) => {
  const f = await fixture(t);
  const qr = await f.qr();
  const { user } = await f.signup(qr.token);
  assert.equal(user.status, "PENDING");
  assert.equal(user.signupVerifiedAt?.toISOString(), now.toISOString());
  assert.equal(user.pendingInviteCode, f.group.inviteCode);
  assert.equal(user.pendingInviteAutoApprove, true);
  assert.equal(await f.db.groupMember.count(), 0);
  assert.ok((await f.db.qrInviteToken.findUniqueOrThrow({ where: { id: qr.id } })).usedAt);
  await assert.rejects(f.signup(qr.token), rejected(410));
  assert.equal(await f.db.user.count(), 2);
});

test("expiry is exactly 60 seconds and cannot be extended by a heartbeat", async (t) => {
  const f = await fixture(t);
  const qr = await f.qr({ leaseUntil: new Date(now.getTime() + 120_000) });
  await assert.rejects(f.signup(qr.token, undefined, undefined, {}, new Date(now.getTime() + 60_000)), rejected(410));
  assert.equal(await f.db.user.count(), 1);
});

test("closed windows, lost heartbeat leases, reserved codes and inactive inviters cannot register", async (t) => {
  const f = await fixture(t);
  for (const fields of [{ revokedAt: now }, { leaseUntil: now }, { leaseUntil: null }, { claimedAt: now }]) {
    const qr = await f.qr(fields);
    await assert.rejects(f.signup(qr.token), rejected(410));
  }
  const qr = await f.qr();
  await f.db.user.update({ where: { id: f.inviter.id }, data: { status: "PENDING" } });
  await assert.rejects(f.signup(qr.token), rejected(410));
  assert.equal(await f.db.signupQuota.count(), 0);
});

test("device quota survives rejected-account deletion and database reconnect", async (t) => {
  const f = await fixture(t);
  const first = await f.signup((await f.qr()).token, "same-device", "ip-one");
  await f.db.user.delete({ where: { id: first.user.id } });
  await f.db.$disconnect();
  await f.db.$connect();
  const qr = await f.qr();
  await assert.rejects(f.signup(qr.token, "same-device", "ip-two"), rejected(429));
  assert.equal((await f.db.qrInviteToken.findUniqueOrThrow({ where: { id: qr.id } })).usedAt, null);
  assert.equal(await f.db.user.count(), 1);
  // A denied request does not use up the other network's quota.
  assert.equal(await f.db.signupQuota.findUnique({ where: { key: "signup:ip:ip-two" } }), null);
});

test("IP quota spans different devices and resets after one hour", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++) await f.signup((await f.qr()).token, `device-${i}`, "same-ip");
  const qr = await f.qr();
  await assert.rejects(f.signup(qr.token, "another-device", "same-ip"), rejected(429));
  assert.equal((await f.db.qrInviteToken.findUniqueOrThrow({ where: { id: qr.id } })).usedAt, null);
  const later = new Date(now.getTime() + 60 * 60_000);
  const laterQr = await f.qr({ expiresAt: new Date(later.getTime() + 60_000), leaseUntil: new Date(later.getTime() + 10_000) });
  await f.signup(laterQr.token, "another-device", "same-ip", {}, later);
});

test("a new signup is permitted after the full 24-hour device cooldown", async (t) => {
  const f = await fixture(t);
  await f.signup((await f.qr()).token, "device", "ip");
  const later = new Date(now.getTime() + 24 * 60 * 60_000);
  const qr = await f.qr({ expiresAt: new Date(later.getTime() + 60_000), leaseUntil: new Date(later.getTime() + 10_000) });
  await f.signup(qr.token, "device", "ip", {}, later);
});

test("failed attempts have durable per-device and per-IP limits", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) await recordSignupAttempt(f.db, { device: "same", ip: "first-ip" }, now);
  await assert.rejects(recordSignupAttempt(f.db, { device: "same", ip: "second-ip" }, now), rejected(429));
  for (let i = 0; i < 20; i++) await recordSignupAttempt(f.db, { device: `other-${i}`, ip: "shared" }, now);
  await assert.rejects(recordSignupAttempt(f.db, { device: "last", ip: "shared" }, now), rejected(429));
  await recordSignupAttempt(f.db, { device: "same", ip: "first-ip" }, new Date(now.getTime() + 10 * 60_000));
});

test("Google registration requires the same live QR and links its verified identity", async (t) => {
  const f = await fixture(t);
  const google = { sub: "verified-google-sub", email: "verified@example.test", name: "Google 회원" };
  await assert.rejects(f.signup("missing", undefined, undefined, { google }), rejected(410));
  const { user } = await f.signup((await f.qr()).token, "google-device", "google-ip", { google });
  assert.equal(user.status, "PENDING");
  assert.equal(user.email, google.email);
  assert.equal(user.employeeId, null);
  const account = await f.db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "google", providerAccountId: google.sub } } });
  assert.equal(account.userId, user.id);
  await assert.rejects(f.signup((await f.qr()).token, undefined, undefined, { google }), rejected(409));
});

test("legacy pending accounts require QR verification; active accounts cannot register again", async (t) => {
  const f = await fixture(t);
  const legacy = await f.db.user.create({ data: { name: "신규 회원", employeeId: "legacy", status: "PENDING" } });
  const { user } = await f.signup((await f.qr()).token, undefined, undefined, { employeeId: "legacy" });
  assert.equal(user.id, legacy.id);
  assert.ok(user.signupVerifiedAt);
  const qr = await f.qr();
  await assert.rejects(f.signup(qr.token, undefined, undefined, { employeeId: "legacy" }), rejected(409));
  assert.equal((await f.db.qrInviteToken.findUniqueOrThrow({ where: { id: qr.id } })).usedAt, null);
});

test("simultaneous requests cannot use the same QR twice", async (t) => {
  const f = await fixture(t);
  const qr = await f.qr();
  const results = await Promise.allSettled([f.signup(qr.token), f.signup(qr.token)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await f.db.user.count(), 2);
});

test("IP identifiers are canonicalized and stored as keyed hashes", () => {
  assert.equal(normalizeIp("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(normalizeIp("2001:0DB8:0000:0000::1"), "2001:db8::1");
  assert.equal(signupIp(new Headers({ "x-forwarded-for": "192.0.2.1, 10.0.0.1" })), "192.0.2.1");
  assert.equal(normalizeIp("made-up"), null);
  assert.notEqual(digestIdentifier("ip", "192.0.2.1", "secret"), digestIdentifier("ip", "192.0.2.1", "different-secret"));
  assert.match(digestIdentifier("ip", "192.0.2.1", "secret"), /^[a-f0-9]{64}$/);
});
