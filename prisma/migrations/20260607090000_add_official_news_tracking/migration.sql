-- AlterTable
ALTER TABLE "Article" ADD COLUMN "heroImageUrl" TEXT;

-- CreateTable
CREATE TABLE "OfficialNewsSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "listUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scanIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "attributionLabel" TEXT NOT NULL,
    "region" TEXT,
    "parserKey" TEXT NOT NULL,
    "lastScanAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialNewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialNewsStory" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "articleId" TEXT,
    "facebookDraftId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "postLabel" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "generatedArticleBody" TEXT,
    "sourceTextHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "updatedSourceAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "county" TEXT,
    "city" TEXT,
    "region" TEXT,
    "officialImageUrl" TEXT,
    "heroImageUrl" TEXT,
    "cardImageHorizontalUrl" TEXT,
    "cardImageVerticalUrl" TEXT,
    "importStatus" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "postStatus" TEXT NOT NULL DEFAULT 'NOT_QUEUED',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialNewsStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialNewsGeneratedAsset" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialNewsGeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialNewsImportLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "storyId" TEXT,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialNewsImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialNewsSource_slug_key" ON "OfficialNewsSource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialNewsStory_canonicalUrl_key" ON "OfficialNewsStory"("canonicalUrl");

-- CreateIndex
CREATE INDEX "OfficialNewsStory_sourceId_createdAt_idx" ON "OfficialNewsStory"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialNewsStory_importStatus_idx" ON "OfficialNewsStory"("importStatus");

-- CreateIndex
CREATE INDEX "OfficialNewsStory_reviewStatus_idx" ON "OfficialNewsStory"("reviewStatus");

-- CreateIndex
CREATE INDEX "OfficialNewsImportLog_sourceId_createdAt_idx" ON "OfficialNewsImportLog"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialNewsImportLog_storyId_createdAt_idx" ON "OfficialNewsImportLog"("storyId", "createdAt");

-- AddForeignKey
ALTER TABLE "OfficialNewsStory" ADD CONSTRAINT "OfficialNewsStory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OfficialNewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialNewsStory" ADD CONSTRAINT "OfficialNewsStory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialNewsGeneratedAsset" ADD CONSTRAINT "OfficialNewsGeneratedAsset_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "OfficialNewsStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialNewsImportLog" ADD CONSTRAINT "OfficialNewsImportLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OfficialNewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialNewsImportLog" ADD CONSTRAINT "OfficialNewsImportLog_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "OfficialNewsStory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
