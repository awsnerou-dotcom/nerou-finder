-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_ownerId_idx" ON "Prospect"("ownerId");

-- CreateIndex
CREATE INDEX "Prospect_stage_idx" ON "Prospect"("stage");
