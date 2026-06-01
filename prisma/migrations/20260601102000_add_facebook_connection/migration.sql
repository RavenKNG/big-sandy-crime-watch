CREATE TABLE "FacebookConnection" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "encryptedPageToken" TEXT NOT NULL,
    "tokenStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "tokenExpiresAt" TIMESTAMP(3),
    "dataAccessExpiresAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastSuccessfulPostAt" TIMESTAMP(3),
    "lastFacebookError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookConnection_pkey" PRIMARY KEY ("id")
);
