-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "orgId" TEXT,
    "status" TEXT NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_agentId_idx" ON "Task"("agentId");

-- CreateIndex
CREATE INDEX "Task_orgId_idx" ON "Task"("orgId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");
