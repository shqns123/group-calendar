ALTER TABLE "Event" ADD COLUMN "overtimeKey" TEXT;
CREATE UNIQUE INDEX "Event_overtimeKey_key" ON "Event"("overtimeKey");
