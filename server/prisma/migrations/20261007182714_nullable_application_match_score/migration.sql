PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchScore" REAL,
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "notes" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "applications_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_applications" (
    "id",
    "studentProfileId",
    "internshipId",
    "status",
    "matchScore",
    "coverLetter",
    "resumeUrl",
    "notes",
    "appliedAt",
    "updatedAt"
)
SELECT
    "id",
    "studentProfileId",
    "internshipId",
    "status",
    "matchScore",
    "coverLetter",
    "resumeUrl",
    "notes",
    "appliedAt",
    "updatedAt"
FROM "applications";

DROP TABLE "applications";
ALTER TABLE "new_applications" RENAME TO "applications";

CREATE UNIQUE INDEX "applications_studentProfileId_internshipId_key" ON "applications"("studentProfileId", "internshipId");
CREATE INDEX "applications_studentProfileId_idx" ON "applications"("studentProfileId");
CREATE INDEX "applications_internshipId_idx" ON "applications"("internshipId");
CREATE INDEX "applications_status_idx" ON "applications"("status");
CREATE INDEX "applications_matchScore_idx" ON "applications"("matchScore");
CREATE INDEX "applications_appliedAt_idx" ON "applications"("appliedAt");
