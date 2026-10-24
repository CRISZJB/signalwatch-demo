-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "naturalLanguage" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "scheduleIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "lastRunAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "lastError" TEXT,
    "degradedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ruleJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "marketSnapshot" TEXT,
    "skipReason" TEXT,
    "fingerprint" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemMeta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RuleVersion_taskId_idx" ON "RuleVersion"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_taskId_version_key" ON "RuleVersion"("taskId", "version");

-- CreateIndex
CREATE INDEX "ExecutionLog_taskId_createdAt_idx" ON "ExecutionLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_taskId_fingerprint_idx" ON "Alert"("taskId", "fingerprint");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
