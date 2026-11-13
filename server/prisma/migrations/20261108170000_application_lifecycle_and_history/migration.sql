-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "closedAt" DATETIME,
    CONSTRAINT "applications_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "applications_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_applications" ("appliedAt", "coverLetter", "id", "internshipId", "matchScore", "notes", "resumeUrl", "status", "studentProfileId", "updatedAt")
SELECT "appliedAt", "coverLetter", "id", "internshipId", "matchScore", "notes", "resumeUrl", "status", "studentProfileId", "updatedAt"
FROM "applications";
DROP TABLE "applications";
ALTER TABLE "new_applications" RENAME TO "applications";
CREATE INDEX "applications_studentProfileId_idx" ON "applications"("studentProfileId");
CREATE INDEX "applications_internshipId_idx" ON "applications"("internshipId");
CREATE INDEX "applications_status_idx" ON "applications"("status");
CREATE INDEX "applications_matchScore_idx" ON "applications"("matchScore");
CREATE INDEX "applications_appliedAt_idx" ON "applications"("appliedAt");
CREATE UNIQUE INDEX "applications_studentProfileId_internshipId_key" ON "applications"("studentProfileId", "internshipId");

CREATE TABLE "new_internship_match_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "matchScore" REAL NOT NULL DEFAULT 0,
    "skillMatch" REAL NOT NULL DEFAULT 0,
    "experienceMatch" REAL NOT NULL DEFAULT 0,
    "educationMatch" REAL NOT NULL DEFAULT 0,
    "locationMatch" REAL NOT NULL DEFAULT 0,
    "overallMatch" REAL NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internship_match_metrics_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_internship_match_metrics" ("applicationId", "calculatedAt", "educationMatch", "experienceMatch", "id", "locationMatch", "matchScore", "overallMatch", "skillMatch")
SELECT "applicationId", "calculatedAt", "educationMatch", "experienceMatch", "id", "locationMatch", "matchScore", "overallMatch", "skillMatch"
FROM "internship_match_metrics";
DROP TABLE "internship_match_metrics";
ALTER TABLE "new_internship_match_metrics" RENAME TO "internship_match_metrics";
CREATE UNIQUE INDEX "internship_match_metrics_applicationId_key" ON "internship_match_metrics"("applicationId");
CREATE INDEX "internship_match_metrics_applicationId_idx" ON "internship_match_metrics"("applicationId");
CREATE INDEX "internship_match_metrics_overallMatch_idx" ON "internship_match_metrics"("overallMatch");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
