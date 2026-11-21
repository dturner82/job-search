CREATE TABLE "ImportedMessage" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"mailbox" TEXT NOT NULL,
	"uidValidity" BIGINT NOT NULL,
	"uid" BIGINT NOT NULL,
	"messageId" TEXT,
	"subject" TEXT,
	"receivedAt" DATETIME NOT NULL,
	"importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Job" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"title" TEXT NOT NULL,
	"company" TEXT,
	"location" TEXT,
	"salary" TEXT,
	"source" TEXT NOT NULL,
	"sourceVacancyId" TEXT,
	"canonicalUrl" TEXT,
	"discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"status" TEXT NOT NULL DEFAULT 'NEW',
	"firstMessageId" INTEGER,
	CONSTRAINT "Job_firstMessageId_fkey" FOREIGN KEY ("firstMessageId") REFERENCES "ImportedMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ImportedMessage_mailbox_uidValidity_uid_key" ON "ImportedMessage"("mailbox", "uidValidity", "uid");
CREATE UNIQUE INDEX "Job_canonicalUrl_key" ON "Job"("canonicalUrl");
CREATE UNIQUE INDEX "Job_source_sourceVacancyId_key" ON "Job"("source", "sourceVacancyId");
CREATE INDEX "Job_discoveredAt_id_idx" ON "Job"("discoveredAt", "id");
