-- CreateTable notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" INTEGER NOT NULL DEFAULT 0,
    "actionUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable student_readiness_metrics
CREATE TABLE "student_readiness_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL UNIQUE,
    "technicalScore" REAL NOT NULL DEFAULT 0,
    "softSkillScore" REAL NOT NULL DEFAULT 0,
    "experienceScore" REAL NOT NULL DEFAULT 0,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "skillGapCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_readiness_metrics_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE
);

-- CreateTable internship_match_metrics
CREATE TABLE "internship_match_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL UNIQUE,
    "matchScore" REAL NOT NULL DEFAULT 0,
    "skillMatch" REAL NOT NULL DEFAULT 0,
    "experienceMatch" REAL NOT NULL DEFAULT 0,
    "educationMatch" REAL NOT NULL DEFAULT 0,
    "locationMatch" REAL NOT NULL DEFAULT 0,
    "overallMatch" REAL NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internship_match_metrics_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE
);

-- CreateIndex notifications_userId
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex notifications_isRead
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex notifications_createdAt
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex audit_logs_userId
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex audit_logs_entityType
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex audit_logs_action
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex audit_logs_createdAt
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex student_readiness_metrics_overallScore
CREATE INDEX "student_readiness_metrics_overallScore_idx" ON "student_readiness_metrics"("overallScore");

-- CreateIndex student_readiness_metrics_updatedAt
CREATE INDEX "student_readiness_metrics_updatedAt_idx" ON "student_readiness_metrics"("updatedAt");

-- CreateIndex internship_match_metrics_applicationId
CREATE INDEX "internship_match_metrics_applicationId_idx" ON "internship_match_metrics"("applicationId");

-- CreateIndex internship_match_metrics_overallMatch
CREATE INDEX "internship_match_metrics_overallMatch_idx" ON "internship_match_metrics"("overallMatch");

-- Add indexes to existing tables

-- CreateIndex users_email
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex users_role
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex users_createdAt
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex password_reset_tokens_userId
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex password_reset_tokens_used
CREATE INDEX "password_reset_tokens_used_idx" ON "password_reset_tokens"("used");

-- CreateIndex password_reset_tokens_expiresAt
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex student_profiles_university
CREATE INDEX "student_profiles_university_idx" ON "student_profiles"("university");

-- CreateIndex student_profiles_city
CREATE INDEX "student_profiles_city_idx" ON "student_profiles"("city");

-- CreateIndex student_profiles_readinessScore
CREATE INDEX "student_profiles_readinessScore_idx" ON "student_profiles"("readinessScore");

-- CreateIndex student_profiles_createdAt
CREATE INDEX "student_profiles_createdAt_idx" ON "student_profiles"("createdAt");

-- CreateIndex employer_profiles_companyName
CREATE INDEX "employer_profiles_companyName_idx" ON "employer_profiles"("companyName");

-- CreateIndex employer_profiles_industry
CREATE INDEX "employer_profiles_industry_idx" ON "employer_profiles"("industry");

-- CreateIndex employer_profiles_city
CREATE INDEX "employer_profiles_city_idx" ON "employer_profiles"("city");

-- CreateIndex employer_profiles_createdAt
CREATE INDEX "employer_profiles_createdAt_idx" ON "employer_profiles"("createdAt");

-- CreateIndex skills_category
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex skills_name
CREATE INDEX "skills_name_idx" ON "skills"("name");

-- CreateIndex student_skills_studentProfileId
CREATE INDEX "student_skills_studentProfileId_idx" ON "student_skills"("studentProfileId");

-- CreateIndex student_skills_skillId
CREATE INDEX "student_skills_skillId_idx" ON "student_skills"("skillId");

-- CreateIndex student_skills_proficiency
CREATE INDEX "student_skills_proficiency_idx" ON "student_skills"("proficiency");

-- CreateIndex internships_employerProfileId
CREATE INDEX "internships_employerProfileId_idx" ON "internships"("employerProfileId");

-- CreateIndex internships_status
CREATE INDEX "internships_status_idx" ON "internships"("status");

-- CreateIndex internships_industry
CREATE INDEX "internships_industry_idx" ON "internships"("industry");

-- CreateIndex internships_isRemote
CREATE INDEX "internships_isRemote_idx" ON "internships"("isRemote");

-- CreateIndex internships_applicationDeadline
CREATE INDEX "internships_applicationDeadline_idx" ON "internships"("applicationDeadline");

-- CreateIndex internships_createdAt
CREATE INDEX "internships_createdAt_idx" ON "internships"("createdAt");

-- CreateIndex internship_skills_internshipId
CREATE INDEX "internship_skills_internshipId_idx" ON "internship_skills"("internshipId");

-- CreateIndex internship_skills_skillId
CREATE INDEX "internship_skills_skillId_idx" ON "internship_skills"("skillId");

-- CreateIndex internship_skills_importance
CREATE INDEX "internship_skills_importance_idx" ON "internship_skills"("importance");

-- CreateIndex applications_studentProfileId
CREATE INDEX "applications_studentProfileId_idx" ON "applications"("studentProfileId");

-- CreateIndex applications_internshipId
CREATE INDEX "applications_internshipId_idx" ON "applications"("internshipId");

-- CreateIndex applications_status
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex applications_matchScore
CREATE INDEX "applications_matchScore_idx" ON "applications"("matchScore");

-- CreateIndex applications_appliedAt
CREATE INDEX "applications_appliedAt_idx" ON "applications"("appliedAt");

-- CreateIndex recommendations_studentProfileId
CREATE INDEX "recommendations_studentProfileId_idx" ON "recommendations"("studentProfileId");

-- CreateIndex recommendations_createdAt
CREATE INDEX "recommendations_createdAt_idx" ON "recommendations"("createdAt");
