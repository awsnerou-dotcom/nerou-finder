-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedSource_orgId_idx" ON "FeedSource"("orgId");

-- CreateIndex
CREATE INDEX "FeedSource_status_idx" ON "FeedSource"("status");
