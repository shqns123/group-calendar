CREATE TABLE "PersonalDayNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalDayNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PersonalDayNote_userId_date_key" ON "PersonalDayNote"("userId", "date");
CREATE INDEX "PersonalDayNote_userId_date_idx" ON "PersonalDayNote"("userId", "date");
