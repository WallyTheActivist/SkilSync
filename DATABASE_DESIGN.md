# SkillSync Database Design Documentation

> **Current implementation reference:** This file is an earlier design document and contains claims that do not match the current schema. Use [docs/technical/database.md](docs/technical/database.md) and `server/prisma/schema.prisma` for the current provider, models, relations, and constraints. In particular, the checked-in schema is SQLite-only; PostgreSQL/Supabase and database CHECK constraints are not currently configured.

## Overview

SkillSync database is built on a fully normalized relational model adhering to Third Normal Form (3NF) principles. The database is designed to support a campus internship and skills matching platform.

## Database Architecture

### Core Principles

- **Normalization Level**: 3NF (Third Normal Form)
- **Database Engine**: SQLite (development), PostgreSQL (production-ready)
- **ORM**: Prisma
- **Data Integrity**: Foreign keys, unique constraints, check constraints
- **Performance**: Comprehensive indexing strategy

## Table Structure & Relationships

### 1. Users (Authentication & Authorization)
```
PRIMARY KEY: id (CUID)
UNIQUE: email
INDEXES: email, role, createdAt

Columns:
- id: CUID (Primary Key)
- email: String (Unique)
- password: String (hashed with bcryptjs)
- role: String (STUDENT | EMPLOYER | ADMIN)
- createdAt: DateTime
- updatedAt: DateTime (Auto-updated)

Relationships:
→ StudentProfile (1:1)
→ EmployerProfile (1:1)
→ PasswordResetToken (1:N)
→ Notification (1:N)
```

**Normalization**: 3NF compliant. Role is stored as normalized reference.

### 2. StudentProfile (Student Information)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: userId → User.id (UNIQUE, CASCADE DELETE)
INDEXES: university, city, readinessScore, createdAt

Columns:
- id: CUID
- userId: String (Unique FK)
- firstName, lastName: String
- phone: String (Optional)
- university: String (Optional)
- faculty: String (Optional)
- degree: String (Optional)
- yearOfStudy: Int (Optional)
- gpa: Float (Optional)
- bio: String (Optional)
- linkedIn, github: String (URLs, Optional)
- portfolioUrl: String (Optional)
- avatarUrl: String (Optional)
- city, country: String (with default)
- readinessScore: Float (calculated field)
- createdAt, updatedAt: DateTime

Relationships:
← User (N:1)
→ StudentSkill (1:N)
→ Application (1:N)
→ Recommendation (1:N)
→ StudentReadinessMetric (1:1)
```

**Normalization**: 3NF compliant. User-specific data separated from User table.

### 3. EmployerProfile (Company Information)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: userId → User.id (UNIQUE, CASCADE Delete)
INDEXES: companyName, industry, city, createdAt

Columns:
- id: CUID
- userId: String (Unique FK)
- companyName: String
- industry: String (Optional)
- website: String (Optional)
- logoUrl: String (Optional)
- description: String (Optional)
- city, country: String (with default)
- createdAt, updatedAt: DateTime

Relationships:
← User (N:1)
→ Internship (1:N)
```

**Normalization**: 3NF compliant. Company-specific data separated from User table.

### 4. Skill (Skills Catalog)
```
PRIMARY KEY: id (CUID)
UNIQUE: name
INDEXES: category, name

Columns:
- id: CUID
- name: String (Unique)
- category: String (PROGRAMMING | FRAMEWORK | DATABASE | CLOUD | DEVOPS | DESIGN | SOFT_SKILL | LANGUAGE | TOOL | OTHER)
- description: String (Optional)
- iconUrl: String (Optional)
- createdAt: DateTime

Relationships:
← StudentSkill (1:N)
← InternshipSkill (1:N)
```

**Normalization**: 3NF compliant. Centralized skill reference eliminates data duplication.

### 5. StudentSkill (M:N Join Table - Student ↔ Skill)
```
PRIMARY KEY: id (CUID)
COMPOSITE UNIQUE: (studentProfileId, skillId)
FOREIGN KEYS:
  - studentProfileId → StudentProfile.id (CASCADE Delete)
  - skillId → Skill.id (CASCADE Delete)
INDEXES: studentProfileId, skillId, proficiency

Columns:
- id: CUID
- studentProfileId: String (FK)
- skillId: String (FK)
- proficiency: String (BEGINNER | ELEMENTARY | INTERMEDIATE | ADVANCED | EXPERT)
- yearsExperience: Float (Optional)
- certificationUrl: String (Optional)
- createdAt, updatedAt: DateTime

Relationships:
← StudentProfile (N:1)
← Skill (N:1)
```

**Normalization**: 3NF compliant. Proper M:N normalization with junction table.

### 6. Internship (Internship Positions)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: employerProfileId → EmployerProfile.id (CASCADE Delete)
INDEXES: employerProfileId, status, industry, isRemote, applicationDeadline, createdAt

Columns:
- id: CUID
- employerProfileId: String (FK)
- title: String
- description: String
- responsibilities: String (Optional)
- requirements: String (Optional)
- location: String (Optional)
- isRemote: Boolean (default: false)
- stipend: Float (Optional)
- currency: String (default: ZAR)
- durationMonths: Int (Optional)
- startDate: DateTime (Optional)
- applicationDeadline: DateTime (Optional)
- status: String (DRAFT | ACTIVE | CLOSED | FILLED)
- industry: String (Optional)
- tags: String (comma-separated, Optional)
- createdAt, updatedAt: DateTime

Relationships:
← EmployerProfile (N:1)
→ InternshipSkill (1:N)
→ Application (1:N)
```

**Normalization**: 3NF compliant. All attributes atomic (no composite values except tags).

### 7. InternshipSkill (M:N Join Table - Internship ↔ Skill)
```
PRIMARY KEY: id (CUID)
COMPOSITE UNIQUE: (internshipId, skillId)
FOREIGN KEYS:
  - internshipId → Internship.id (CASCADE Delete)
  - skillId → Skill.id (CASCADE Delete)
INDEXES: internshipId, skillId, importance

Columns:
- id: CUID
- internshipId: String (FK)
- skillId: String (FK)
- importance: Int (1=nice-to-have, 3=preferred, 5=required)
- minimumLevel: String (BEGINNER | ELEMENTARY | INTERMEDIATE | ADVANCED | EXPERT)

Relationships:
← Internship (N:1)
← Skill (N:1)
```

**Normalization**: 3NF compliant. Proper M:N normalization with additional attributes.

### 8. Application (Job Applications)
```
PRIMARY KEY: id (CUID)
COMPOSITE UNIQUE: (studentProfileId, internshipId)
FOREIGN KEYS:
  - studentProfileId → StudentProfile.id (CASCADE Delete)
  - internshipId → Internship.id (CASCADE Delete)
INDEXES: studentProfileId, internshipId, status, matchScore, appliedAt

Columns:
- id: CUID
- studentProfileId: String (FK)
- internshipId: String (FK)
- status: String (PENDING | UNDER_REVIEW | SHORTLISTED | INTERVIEW_SCHEDULED | OFFERED | ACCEPTED | REJECTED | WITHDRAWN)
- matchScore: Float (0-100, calculated by matching algorithm)
- coverLetter: String (Optional)
- resumeUrl: String (Optional)
- notes: String (Optional)
- appliedAt: DateTime
- updatedAt: DateTime

Relationships:
← StudentProfile (N:1)
← Internship (N:1)
→ InternshipMatchMetric (1:1)
```

**Normalization**: 3NF compliant. No data duplication; all relationships properly normalized.

### 9. Recommendation (Personalized Recommendations)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: studentProfileId → StudentProfile.id (CASCADE Delete)
INDEXES: studentProfileId, createdAt

Columns:
- id: CUID
- studentProfileId: String (FK)
- type: String (skill_gap | course | certification | internship)
- title: String
- description: String
- resourceUrl: String (Optional)
- priority: Int (1=low, 2=medium, 3=high)
- skillId: String (Optional, reference to Skill)
- isCompleted: Boolean (default: false)
- createdAt, updatedAt: DateTime

Relationships:
← StudentProfile (N:1)
```

**Normalization**: 3NF compliant. Separate recommendation entity for extensibility.

### 10. Notification (User Notifications)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: userId → User.id (CASCADE Delete)
INDEXES: userId, isRead, createdAt

Columns:
- id: CUID
- userId: String (FK)
- type: String (application_update | match_found | message | system)
- title: String
- message: String
- relatedEntityType: String (application | internship | recommendation)
- relatedEntityId: String (Optional)
- isRead: Boolean (default: false)
- actionUrl: String (Optional)
- createdAt: DateTime
- readAt: DateTime (Optional)

Relationships:
← User (N:1)
```

**Normalization**: 3NF compliant. Separate notification table for proper tracking.

### 11. AuditLog (System Auditing)
```
PRIMARY KEY: id (CUID)
FOREIGN KEY: userId → User.id (Optional, nullable)
INDEXES: userId, entityType, action, createdAt

Columns:
- id: CUID
- userId: String (FK, Optional)
- action: String (create | update | delete | login | logout)
- entityType: String (user | application | internship | student_profile | etc.)
- entityId: String
- changes: String (JSON-stringified before/after changes)
- ipAddress: String (Optional)
- userAgent: String (Optional)
- status: String (SUCCESS | FAILURE, default: SUCCESS)
- errorMessage: String (Optional)
- createdAt: DateTime

Relationships:
← User (N:1, optional)
```

**Normalization**: 3NF compliant. Proper audit trail for compliance and debugging.

### 12. StudentReadinessMetric (Calculated Metrics)
```
PRIMARY KEY: id (CUID)
UNIQUE: studentProfileId
FOREIGN KEY: studentProfileId → StudentProfile.id (CASCADE Delete)
INDEXES: overallScore, updatedAt

Columns:
- id: CUID
- studentProfileId: String (FK, UNIQUE)
- technicalScore: Float (0-100)
- softSkillScore: Float (0-100)
- experienceScore: Float (0-100)
- overallScore: Float (0-100)
- skillGapCount: Int
- lastCalculatedAt: DateTime
- updatedAt: DateTime

Relationships:
← StudentProfile (1:1)
```

**Purpose**: Materialized view for reporting performance. Calculated by backend algorithm.

### 13. InternshipMatchMetric (Calculated Metrics)
```
PRIMARY KEY: id (CUID)
UNIQUE: applicationId
FOREIGN KEY: applicationId → Application.id (CASCADE Delete)
INDEXES: applicationId, overallMatch

Columns:
- id: CUID
- applicationId: String (FK, UNIQUE)
- matchScore: Float (0-100)
- skillMatch: Float (0-100)
- experienceMatch: Float (0-100)
- educationMatch: Float (0-100)
- locationMatch: Float (0-100)
- overallMatch: Float (0-100)
- calculatedAt: DateTime

Relationships:
← Application (1:1)
```

**Purpose**: Detailed match score breakdown for reporting and analysis.

### 14. PasswordResetToken (Password Recovery)
```
PRIMARY KEY: id (CUID)
UNIQUE: tokenHash
FOREIGN KEY: userId → User.id (CASCADE Delete)
INDEXES: userId, used, expiresAt

Columns:
- id: CUID
- userId: String (FK)
- tokenHash: String (UNIQUE, SHA256 hash)
- expiresAt: DateTime
- used: Boolean (default: false)
- createdAt: DateTime

Relationships:
← User (N:1)
```

**Normalization**: 3NF compliant. Separate table for token management.

## Normalization Analysis

### First Normal Form (1NF)
✅ All attributes are atomic (no repeating groups or composite attributes except stringified JSON)
✅ Each row uniquely identifiable by primary key
✅ No duplicate rows within table

### Second Normal Form (2NF)
✅ All 1NF requirements met
✅ No partial dependencies (non-key attributes depend on entire primary key)
✅ For composite keys (M:N tables), all attributes depend on full key combination

### Third Normal Form (3NF)
✅ All 2NF requirements met
✅ No transitive dependencies (non-key attributes don't depend on other non-key attributes)
✅ Skill information not duplicated in StudentSkill/InternshipSkill
✅ User role information normalized in separate User table
✅ Related attributes properly separated into different entities

## Indexing Strategy

### Performance Indexes

**High-Priority Search Columns**:
- `users.email` - Authentication
- `users.role` - Authorization filtering
- `applications.status` - Status-based filtering
- `internships.status` - Active position filtering
- `student_profiles.readinessScore` - Sorting and ranking

**Foreign Key Indexes**:
- All FK columns indexed for JOIN performance
- `studentProfileId`, `internshipId`, `userId` optimized

**Temporal Indexes**:
- `createdAt`, `updatedAt` - Range queries for reporting
- `applicationDeadline` - Finding open applications
- `expiresAt` - Token expiration queries

**Business Logic Indexes**:
- `internships.isRemote` - Remote position filtering
- `applications.matchScore` - Top matches queries
- `student_skills.proficiency` - Skill level filtering

## Foreign Key Constraints

All foreign key relationships use `CASCADE DELETE` to:
1. Maintain referential integrity
2. Automatically clean up dependent records
3. Prevent orphaned data

Example: Deleting a User cascades to StudentProfile, EmployerProfile, Applications, etc.

## Unique Constraints

### Composite Unique Constraints
- `StudentSkill(studentProfileId, skillId)` - Prevent duplicate skill entries
- `InternshipSkill(internshipId, skillId)` - Prevent duplicate skill requirements
- `Application(studentProfileId, internshipId)` - One application per student per position

### Single Column Unique Constraints
- `User.email` - Unique email for authentication
- `Skill.name` - Prevent skill name duplication
- `PasswordResetToken.tokenHash` - Unique token validation
- `StudentReadinessMetric.studentProfileId` - One metric per student
- `InternshipMatchMetric.applicationId` - One metric per application

## Query Optimization Opportunities

### Common Queries & Indexes
```sql
-- Find student applications by status
SELECT * FROM applications WHERE status = 'PENDING' AND studentProfileId = ?
-- INDEXES: applications(status), applications(studentProfileId)

-- Find internships by deadline
SELECT * FROM internships WHERE applicationDeadline > NOW() AND status = 'ACTIVE'
-- INDEXES: internships(applicationDeadline), internships(status)

-- Find students with specific skill
SELECT sp.* FROM student_profiles sp
JOIN student_skills ss ON sp.id = ss.studentProfileId
JOIN skills s ON ss.skillId = s.id
WHERE s.name = 'Python' AND ss.proficiency >= 'INTERMEDIATE'
-- INDEXES: skills(name), student_skills(skillId), student_skills(proficiency)

-- Top matched applications
SELECT * FROM applications WHERE status IN ('ACCEPTED', 'OFFERED')
ORDER BY matchScore DESC LIMIT 10
-- INDEX: applications(matchScore, status)
```

## Data Integrity Constraints

### Referential Integrity
- All FK relationships enforced at database level
- Orphaned records prevented by CASCADE DELETE
- Data consistency guaranteed across related tables

### Business Logic Constraints (Application Level)
- Application status state machine (PENDING → OFFERED → ACCEPTED)
- Skill proficiency levels enforced (BEGINNER to EXPERT)
- Match score validation (0-100 range)
- Priority levels for recommendations (1-3 scale)

## Scalability Considerations

### For Large-Scale Deployment
1. **Partitioning**: Applications table can be partitioned by year/status
2. **Archiving**: Move old audit logs to archive tables
3. **Read Replicas**: Reports queries can use read-only replicas
4. **Materialized Views**: Pre-compute readiness scores periodically
5. **Caching**: Cache frequently accessed skills and internship data

### Database Versioning
- Migration files tracked in `prisma/migrations/`
- Each schema change has timestamped migration
- Rollback capability maintained for 5 major versions

## Backup & Recovery Strategy

### Critical Tables (Daily Backup)
- User, StudentProfile, EmployerProfile (customer data)
- Application, Internship (business-critical)

### Non-Critical Tables (Weekly Backup)
- Notification, AuditLog, Recommendation

### Recovery Objectives
- RTO (Recovery Time Objective): < 1 hour
- RPO (Recovery Point Objective): < 1 day

## Conclusion

SkillSync database design achieves:
- ✅ Full 3NF normalization
- ✅ Referential integrity through foreign keys
- ✅ Optimal performance through strategic indexing
- ✅ Scalability for production deployment
- ✅ Comprehensive audit trail for compliance
- ✅ Calculated metrics for analytics and reporting
