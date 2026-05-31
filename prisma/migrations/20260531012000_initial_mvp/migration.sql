-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "FacebookStatus" AS ENUM ('NOT_QUEUED', 'DRAFTED', 'QUEUED', 'POSTED', 'FAILED', 'MANUAL_REQUIRED');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('CORRECTION', 'HIDE', 'DEINDEX', 'EXPUNGEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('NEW', 'REVIEWING', 'RESOLVED', 'DENIED');

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "county" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRecordDemo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "county" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceTimestamp" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "imageLocalPath" TEXT,
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "facebookPostStatus" "FacebookStatus" NOT NULL DEFAULT 'NOT_QUEUED',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "complianceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRecordDemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeDemo" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "offense" TEXT NOT NULL,
    "statute" TEXT,
    "chargeDescription" TEXT NOT NULL,
    "caseNumber" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChargeDemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceImportRun" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" JSONB,

    CONSTRAINT "SourceImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookDraft" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "recordId" TEXT,
    "status" "FacebookStatus" NOT NULL DEFAULT 'DRAFTED',
    "scheduledFor" TIMESTAMP(3),
    "postText" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "facebookPostId" TEXT,
    "facebookCommentId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "recordId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requestType" "CorrectionType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorAd" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "text" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PublicRecordDemo_slug_key" ON "PublicRecordDemo"("slug");

-- AddForeignKey
ALTER TABLE "ChargeDemo" ADD CONSTRAINT "ChargeDemo_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PublicRecordDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookDraft" ADD CONSTRAINT "FacebookDraft_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookDraft" ADD CONSTRAINT "FacebookDraft_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PublicRecordDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PublicRecordDemo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
