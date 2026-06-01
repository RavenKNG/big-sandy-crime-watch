ALTER TABLE "PublicRecordDemo"
ADD COLUMN "sourceFingerprint" TEXT;

CREATE UNIQUE INDEX "PublicRecordDemo_sourceFingerprint_key"
ON "PublicRecordDemo"("sourceFingerprint");
