ALTER TABLE "PublicRecordDemo"
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "sourceRecordId" TEXT,
ADD COLUMN "bookingDateTimeText" TEXT,
ADD COLUMN "bookingDate" TIMESTAMP(3),
ADD COLUMN "bookingTimeKnown" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PublicRecordDemo"
SET "bookingDate" = date_trunc('day', "recordDate");

ALTER TABLE "PublicRecordDemo"
ALTER COLUMN "bookingDate" SET NOT NULL;

CREATE UNIQUE INDEX "PublicRecordDemo_sourceRecordId_key"
ON "PublicRecordDemo"("sourceRecordId");
