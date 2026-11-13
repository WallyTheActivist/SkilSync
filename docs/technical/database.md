# Database Schema and ERD

## Source of Truth

The schema in [server/prisma/schema.prisma](../../server/prisma/schema.prisma) is authoritative. The configured datasource is SQLite with its file URL supplied by `DATABASE_URL`; schema enums are stored as strings and validated in application routes/controllers. PostgreSQL/Supabase is not the configured provider.

## Entity Relationship Diagram

```mermaid
erDiagram
  User ||--o| StudentProfile : has
  User ||--o| EmployerProfile : has
  User ||--o{ PasswordResetToken : requests
  User ||--o{ Notification : receives
  StudentProfile ||--o{ StudentSkill : owns
  Skill ||--o{ StudentSkill : catalogues
  EmployerProfile ||--o{ Internship : posts
  Internship ||--o{ InternshipSkill : requires
  Skill ||--o{ InternshipSkill : catalogues
  StudentProfile ||--o{ Application : submits
  Internship ||--o{ Application : receives
  StudentProfile ||--o{ Recommendation : receives
  StudentProfile ||--o| StudentReadinessMetric : has
  Application ||--o| InternshipMatchMetric : has

  User {
    string id PK
    string email UK
    string password
    string role
  }
  StudentProfile {
    string id PK
    string userId FK_UK
    string firstName
    string lastName
    float readinessScore
  }
  EmployerProfile {
    string id PK
    string userId FK_UK
    string companyName
  }
  Skill {
    string id PK
    string name UK
    string category
  }
  StudentSkill {
    string id PK
    string studentProfileId FK
    string skillId FK
    string proficiency
  }
  Internship {
    string id PK
    string employerProfileId FK
    string title
    string status
  }
  InternshipSkill {
    string id PK
    string internshipId FK
    string skillId FK
    int importance
  }
  Application {
    string id PK
    string studentProfileId FK
    string internshipId FK
    string status
    float matchScore
  }
  Recommendation {
    string id PK
    string studentProfileId FK
    string skillId
    string type
  }
  Notification {
    string id PK
    string userId FK
    string type
    boolean isRead
  }
  PasswordResetToken {
    string id PK
    string userId FK
    string tokenHash UK
    datetime expiresAt
  }
  AuditLog {
    string id PK
    string userId
    string action
    string entityType
  }
  StudentReadinessMetric {
    string id PK
    string studentProfileId FK_UK
    float overallScore
  }
  InternshipMatchMetric {
    string id PK
    string applicationId FK_UK
    float overallMatch
  }
```

`AuditLog.userId` and `Recommendation.skillId` are scalar fields without Prisma relations. A line in a conceptual diagram must not be inferred for those two fields.

## Models and Mapped Tables

Prisma IDs use `String @id @default(cuid())`. Unless noted, timestamps are `DateTime`; nullable fields are marked `?`. Prisma `@@map` names are shown in the table column.

| Prisma model (table) | Main fields and constraints | Relations/index notes |
|---|---|---|
| `User` (`users`) | `id`, unique `email`, `password` hash, `role` default `STUDENT`, `createdAt`, `updatedAt` | Optional one-to-one student/employer profile; one-to-many password reset tokens and notifications. Indexes email, role, createdAt. |
| `PasswordResetToken` (`password_reset_tokens`) | `id`, `userId`, unique `tokenHash`, `expiresAt`, `used` default false, `createdAt` | User FK with cascade delete; indexes userId, used, expiresAt. Raw reset token is not stored. |
| `StudentProfile` (`student_profiles`) | `id`, unique `userId`, required names, optional phone/university/faculty/degree/year/gpa/bio/social URLs/avatar/city, country default `South Africa`, `readinessScore` default 0, timestamps | User FK with cascade; student skills, applications, recommendations, optional one-to-one readiness metric. Indexes university, city, readinessScore, createdAt. |
| `EmployerProfile` (`employer_profiles`) | `id`, unique `userId`, `companyName`, optional industry/website/logo/description/city, country default `South Africa`, timestamps | User FK with cascade; one-to-many internships. Indexes companyName, industry, city, createdAt. |
| `Skill` (`skills`) | `id`, unique `name`, category default `OTHER`, optional description/iconUrl, createdAt | One-to-many student and internship skill links. Indexes category and name. |
| `StudentSkill` (`student_skills`) | `id`, `studentProfileId`, `skillId`, proficiency default `BEGINNER`, optional yearsExperience/certificationUrl, timestamps | FKs to profile and skill with cascade; unique `(studentProfileId, skillId)`. Indexes both FKs and proficiency. |
| `Internship` (`internships`) | `id`, `employerProfileId`, title/description, optional responsibilities/requirements/location/stipend/duration/dates/industry/tags, `isRemote` false, currency `ZAR`, status `ACTIVE`, timestamps | Employer FK with cascade; required-skill links and applications. Indexed by employer, status, industry, remote, deadline, createdAt. `tags` is a string, not a relation. |
| `InternshipSkill` (`internship_skills`) | `id`, `internshipId`, `skillId`, importance default 3, minimumLevel default `BEGINNER` | FKs with cascade; unique `(internshipId, skillId)`. Indexes both FKs and importance. |
| `Application` (`applications`) | `id`, studentProfileId, internshipId, status default `PENDING`, optional matchScore/coverLetter/resumeUrl/notes, appliedAt, updatedAt, optional `closedAt` | FKs to student profile and internship with `RESTRICT`; unique `(studentProfileId, internshipId)`; optional one-to-one match metric. `closedAt` is the employer-only lifecycle state and does not change `status`. Indexes both FKs, status, matchScore, appliedAt. |
| `Recommendation` (`recommendations`) | `id`, studentProfileId, type/title/description, optional resourceUrl/skillId, priority default 1, isCompleted false, timestamps | Student profile FK with cascade. `skillId` is not a declared FK. Indexes studentProfileId and createdAt. |
| `Notification` (`notifications`) | `id`, userId, type/title/message, optional related entity fields/actionUrl, `isRead` false, createdAt, optional readAt | User FK with cascade; indexes userId, isRead, createdAt. The model exists, but notification routes/writes are not implemented. |
| `AuditLog` (`audit_logs`) | `id`, optional userId, action/entityType/entityId, optional changes/ipAddress/userAgent/errorMessage, status default `SUCCESS`, createdAt | No declared relation on userId. Indexes userId, entityType, action, createdAt. Automatic audit writes are not implemented. |
| `StudentReadinessMetric` (`student_readiness_metrics`) | `id`, unique studentProfileId, technical/softSkill/experience/overall scores default 0, skillGapCount 0, lastCalculatedAt, updatedAt | Student profile FK with cascade; indexes overallScore/updatedAt. Current readiness calculation updates `StudentProfile.readinessScore`, not this metric model. |
| `InternshipMatchMetric` (`internship_match_metrics`) | `id`, unique applicationId, matchScore/skillMatch/experienceMatch/educationMatch/locationMatch/overallMatch default 0, calculatedAt | Application FK with cascade; indexes applicationId/overallMatch. Current applications store match score on `Application`; this metric model is not refreshed by current flow. |

## Field Inventory

Types and nullability below follow the Prisma schema. `?` means nullable; defaults are shown after `=`. Every model uses a CUID string ID unless otherwise stated.

| Model | Fields |
|---|---|
| `User` | `id String`; `email String @unique`; `password String`; `role String = "STUDENT"`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `PasswordResetToken` | `id String`; `userId String`; `tokenHash String @unique`; `expiresAt DateTime`; `used Boolean = false`; `createdAt DateTime = now` |
| `StudentProfile` | `id String`; `userId String @unique`; `firstName String`; `lastName String`; `phone String?`; `university String?`; `faculty String?`; `degree String?`; `yearOfStudy Int?`; `gpa Float?`; `bio String?`; `linkedIn String?`; `github String?`; `portfolioUrl String?`; `avatarUrl String?`; `city String?`; `country String = "South Africa"`; `readinessScore Float = 0`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `EmployerProfile` | `id String`; `userId String @unique`; `companyName String`; `industry String?`; `website String?`; `logoUrl String?`; `description String?`; `city String?`; `country String = "South Africa"`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `Skill` | `id String`; `name String @unique`; `category String = "OTHER"`; `description String?`; `iconUrl String?`; `createdAt DateTime = now` |
| `StudentSkill` | `id String`; `studentProfileId String`; `skillId String`; `proficiency String = "BEGINNER"`; `yearsExperience Float?`; `certificationUrl String?`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `Internship` | `id String`; `employerProfileId String`; `title String`; `description String`; `responsibilities String?`; `requirements String?`; `location String?`; `isRemote Boolean = false`; `stipend Float?`; `currency String = "ZAR"`; `durationMonths Int?`; `startDate DateTime?`; `applicationDeadline DateTime?`; `status String = "ACTIVE"`; `industry String?`; `tags String?`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `InternshipSkill` | `id String`; `internshipId String`; `skillId String`; `importance Int = 3`; `minimumLevel String = "BEGINNER"` |
| `Application` | `id String`; `studentProfileId String`; `internshipId String`; `status String = "PENDING"`; `matchScore Float?`; `coverLetter String?`; `resumeUrl String?`; `notes String?`; `appliedAt DateTime = now`; `updatedAt DateTime @updatedAt`; `closedAt DateTime?` |
| `Recommendation` | `id String`; `studentProfileId String`; `type String`; `title String`; `description String`; `resourceUrl String?`; `priority Int = 1`; `skillId String?`; `isCompleted Boolean = false`; `createdAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `Notification` | `id String`; `userId String`; `type String`; `title String`; `message String`; `relatedEntityType String?`; `relatedEntityId String?`; `isRead Boolean = false`; `actionUrl String?`; `createdAt DateTime = now`; `readAt DateTime?` |
| `AuditLog` | `id String`; `userId String?`; `action String`; `entityType String`; `entityId String`; `changes String?`; `ipAddress String?`; `userAgent String?`; `status String = "SUCCESS"`; `errorMessage String?`; `createdAt DateTime = now` |
| `StudentReadinessMetric` | `id String`; `studentProfileId String @unique`; `technicalScore Float = 0`; `softSkillScore Float = 0`; `experienceScore Float = 0`; `overallScore Float = 0`; `skillGapCount Int = 0`; `lastCalculatedAt DateTime = now`; `updatedAt DateTime @updatedAt` |
| `InternshipMatchMetric` | `id String`; `applicationId String @unique`; `matchScore Float = 0`; `skillMatch Float = 0`; `experienceMatch Float = 0`; `educationMatch Float = 0`; `locationMatch Float = 0`; `overallMatch Float = 0`; `calculatedAt DateTime = now` |

## Constraints and Runtime Notes

- SQLite does not provide native Prisma enums here; role, status, proficiency, category, and recommendation type are string fields. Allowed values are enforced by application logic where implemented.
- Declared foreign keys generally use `onDelete: Cascade`; application foreign keys use `Restrict` so deleting a student or internship cannot erase application history. Those parent deletions return a conflict while applications still reference the record.
- Passwords are stored in `User.password` as bcrypt hashes. Reset tokens are stored as SHA-256 hashes.
- Matching reads `StudentSkill` and `InternshipSkill`; the computed match score is stored on `Application.matchScore` when an application is created.
- No database CHECK constraints are present in the checked-in Prisma schema. Do not rely on design documents that claim otherwise.
- The checked-in migrations are the supported SQLite migration history. A PostgreSQL/Supabase deployment requires a separately verified Prisma provider and migration path.