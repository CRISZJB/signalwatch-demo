-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "naturalLanguage" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "scheduleIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "lastRunAt" DATETIME,
    "lastAlertAt" DATETIME,
    "lastError" TEXT,
    "degradedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ruleJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "marketSnapshot" TEXT,
    "skipReason" TEXT,
    "fingerprint" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
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
