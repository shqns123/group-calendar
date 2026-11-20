ALTER TABLE "User" ADD COLUMN "signupVerifiedAt" DATETIME;
-- Older deployments created this table through db push rather than a migration.
CREATE TABLE IF NOT EXISTS "QrInviteToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "claimedById" TEXT,
    "claimSecret" TEXT,
    "claimedAt" DATETIME,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrInviteToken_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrInviteToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "QrInviteToken_token_key" ON "QrInviteToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "QrInviteToken_claimSecret_key" ON "QrInviteToken"("claimSecret");
ALTER TABLE "QrInviteToken" ADD COLUMN "leaseUntil" DATETIME;
ALTER TABLE "QrInviteToken" ADD COLUMN "revokedAt" DATETIME;

CREATE TABLE "SignupQuota" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "SignupQuota_expiresAt_idx" ON "SignupQuota"("expiresAt");
