PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resourceUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "skillId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recommendations_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recommendations_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_recommendations" (
    "id",
    "studentProfileId",
    "type",
    "title",
    "description",
    "resourceUrl",
    "priority",
    "skillId",
    "isCompleted",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "studentProfileId",
    "type",
    "title",
    "description",
    "resourceUrl",
    "priority",
    CASE
        WHEN "skillId" IS NOT NULL AND EXISTS (SELECT 1 FROM "skills" WHERE "skills"."id" = "recommendations"."skillId")
        THEN "skillId"
        ELSE NULL
    END,
    "isCompleted",
    "createdAt",
    "updatedAt"
FROM "recommendations";

DROP TABLE "recommendations";
ALTER TABLE "new_recommendations" RENAME TO "recommendations";

CREATE INDEX "recommendations_studentProfileId_idx" ON "recommendations"("studentProfileId");
CREATE INDEX "recommendations_createdAt_idx" ON "recommendations"("createdAt");

CREATE TABLE "new_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_audit_logs" (
    "id",
    "userId",
    "action",
    "entityType",
    "entityId",
    "changes",
    "ipAddress",
    "userAgent",
    "status",
    "errorMessage",
    "createdAt"
)
SELECT
    "id",
    CASE
        WHEN "userId" IS NOT NULL AND EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "audit_logs"."userId")
        THEN "userId"
        ELSE NULL
    END,
    "action",
    "entityType",
    "entityId",
    "changes",
    "ipAddress",
    "userAgent",
    "status",
    "errorMessage",
    "createdAt"
FROM "audit_logs";

DROP TABLE "audit_logs";
ALTER TABLE "new_audit_logs" RENAME TO "audit_logs";

CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
