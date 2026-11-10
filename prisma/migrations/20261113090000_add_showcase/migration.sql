-- CreateTable
CREATE TABLE "ShowcaseEntry" (
    "id" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "ShowcaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowcaseEntry_published_idx" ON "ShowcaseEntry"("published");
