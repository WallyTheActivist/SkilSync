-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "university" TEXT,
    "faculty" TEXT,
    "degree" TEXT,
    "yearOfStudy" INTEGER,
    "gpa" REAL,
    "bio" TEXT,
    "linkedIn" TEXT,
    "github" TEXT,
    "portfolioUrl" TEXT,
    "avatarUrl" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'South Africa',
    "readinessScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employer_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'South Africa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "iconUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "student_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL DEFAULT 'BEGINNER',
    "yearsExperience" REAL,
    "certificationUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_skills_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "internships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "stipend" REAL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "durationMonths" INTEGER,
    "startDate" DATETIME,
    "applicationDeadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "industry" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "internships_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "internship_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internshipId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "minimumLevel" TEXT NOT NULL DEFAULT 'BEGINNER',
    CONSTRAINT "internship_skills_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "internship_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchScore" REAL NOT NULL DEFAULT 0,
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "notes" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "applications_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recommendations" (
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
    CONSTRAINT "recommendations_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employer_profiles_userId_key" ON "employer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "student_skills_studentProfileId_skillId_key" ON "student_skills"("studentProfileId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "internship_skills_internshipId_skillId_key" ON "internship_skills"("internshipId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_studentProfileId_internshipId_key" ON "applications"("studentProfileId", "internshipId");
