# Architecture and Diagrams

## System Architecture

In development, Vite serves the React client on port 5173 and proxies `/api` and `/uploads` to the Express server, normally on port 5000. The Express server applies Helmet, CORS, rate limiting, request-origin checks, body parsing, and JSON-body validation before mounting the API routers. Controllers use Prisma; matching and report calculations use server services. Avatar/logo files are stored under the server uploads directory and served from `/uploads`.

```mermaid
flowchart LR
  Actors[Student, Employer, Admin] --> Browser[React and TypeScript client]
  Browser -->|/api and /uploads in development| Vite[Vite dev server and proxy]
  Vite --> API[Express API]
  API --> Sec[Helmet, CORS, rate limits, origin and JSON checks]
  Sec --> Routers[Auth, student, skills, internship, application, employer, admin, report routes]
  Routers --> Controllers[HTTP controllers]
  Controllers --> Match[Matching service]
  Controllers --> Reports[Report service and PDFKit]
  Controllers --> Prisma[Prisma Client]
  Match --> Prisma
  Reports --> Prisma
  Prisma --> DB[(SQLite via DATABASE_URL)]
  Controllers --> Uploads[(uploads/avatars files)]
```

This diagram shows the configured local arrangement. A production reverse proxy, separate object store, PostgreSQL/Supabase backend, email provider, and deployment topology are not defined in the repository.

## Use Case Diagram

```mermaid
flowchart LR
  Student[Student] --- RegisterStudent((Register or sign in))
  Student --- Profile((Maintain profile and skills))
  Student --- Browse((Browse internships))
  Student --- Match((View recommendations and match score))
  Student --- Apply((Apply and track or withdraw application))
  Student --- Gaps((View skill gaps and recommendations))

  Employer[Employer] --- RegisterEmployer((Register or sign in))
  Employer --- Company((Maintain company profile))
  Employer --- Post((Create and manage internships and required skills))
  Employer --- Applicants((View applicants and update application status))

  Admin[Admin] --- AdminManage((Manage users, internships, and skills))
  Admin --- AdminAnalytics((View platform analytics))
  Admin --- Reports((Request reports and PDF exports through API))
```

Admin report requests exist in the API. The client currently exposes Analytics, not a dedicated Reports page.

## Conceptual Class Diagram

The data classes are Prisma models, not hand-written TypeScript domain classes. Service/controller nodes reflect actual server modules.

```mermaid
classDiagram
  class User {
    id
    email
    password
    role
  }
  class StudentProfile {
    id
    userId
    firstName
    lastName
    readinessScore
  }
  class EmployerProfile {
    id
    userId
    companyName
  }
  class Skill {
    id
    name
    category
  }
  class StudentSkill {
    studentProfileId
    skillId
    proficiency
  }
  class Internship {
    id
    employerProfileId
    title
    status
  }
  class InternshipSkill {
    internshipId
    skillId
    importance
    minimumLevel
  }
  class Application {
    id
    studentProfileId
    internshipId
    status
    matchScore
  }
  class MatchingService {
    calculateMatchScore()
    calculateReadinessScore()
    getTopMatches()
    getSkillGapAnalysis()
    generateRecommendations()
  }
  class ReportService {
    getStudentReadinessReport()
    getInternshipMatchReport()
    getApplicationStatisticsReport()
    getSkillsDemandReport()
    exportToPDF()
  }
  User "1" --> "0..1" StudentProfile
  User "1" --> "0..1" EmployerProfile
  StudentProfile "1" --> "*" StudentSkill
  Skill "1" --> "*" StudentSkill
  EmployerProfile "1" --> "*" Internship
  Internship "1" --> "*" InternshipSkill
  Skill "1" --> "*" InternshipSkill
  StudentProfile "1" --> "*" Application
  Internship "1" --> "*" Application
  MatchingService ..> StudentSkill
  MatchingService ..> InternshipSkill
  ReportService ..> Application
  ReportService ..> StudentProfile
```

## Authentication Sequence

```mermaid
sequenceDiagram
  actor User
  participant Client as React client
  participant API as Express API
  participant Auth as Auth routes/controller
  participant DB as Prisma and SQLite
  User->>Client: Submit email and password
  Client->>API: POST /api/auth/login
  API->>API: CORS, rate limit, origin/body validation
  API->>Auth: Validate request and call login controller
  Auth->>DB: Find user by normalized email
  DB-->>Auth: User record and password hash
  Auth->>Auth: bcrypt.compare and sign HS256 JWT
  Auth-->>Client: User summary and HttpOnly cookie
  Client->>API: GET /api/auth/me with cookie
  API->>Auth: Verify JWT and load current user
  Auth->>DB: Find user and profile
  DB-->>Auth: Current user/profile
  Auth-->>Client: User summary
```

Registration uses the same cookie session pattern after creating a student or employer account. Public registration does not create admins.

## Application Activity

```mermaid
flowchart TD
  Start([Student signed in]) --> Browse[Browse internships]
  Browse --> Select{Select internship}
  Select -->|No| Browse
  Select -->|Yes| Validate[Validate application request]
  Validate --> Active{Internship is active?}
  Active -->|No| Stop[Return validation error]
  Active -->|Yes| Duplicate{Already applied?}
  Duplicate -->|Yes| Conflict[Return duplicate conflict]
  Duplicate -->|No| Score[Calculate skill match]
  Score --> Save[Create application with match score]
  Save --> Done([Application is pending employer review])
```

## Application Sequence

```mermaid
sequenceDiagram
  actor Student
  participant Client as React client
  participant API as Express application route
  participant Controller as Application controller
  participant Matching as Matching service
  participant DB as Prisma and SQLite
  Student->>Client: Submit internship application
  Client->>API: POST /api/applications with cookie
  API->>API: Verify session, STUDENT role, origin and input
  API->>Controller: applyForInternship
  Controller->>DB: Resolve student profile and active internship
  Controller->>DB: Check unique student/internship application
  Controller->>Matching: Calculate match score
  Matching->>DB: Read student skills and required skills
  DB-->>Matching: Skill records
  Matching-->>Controller: Score and breakdown
  Controller->>DB: Create application
  DB-->>Controller: Application record
  Controller-->>Client: 201 response with application
```

## DFD Level 0

```mermaid
flowchart LR
  Student[Student] -->|Profile, skills, application requests| System((SkillSync))
  System -->|Internships, matches, readiness and application status| Student
  Employer[Employer] -->|Company profile, internships, applicant decisions| System
  System -->|Applicants and posting data| Employer
  Admin[Admin] -->|User, internship and skill administration| System
  System -->|Analytics and report responses/PDFs| Admin
  System <--> DB[(SQLite database via Prisma)]
  System <--> Files[(Avatar and logo files)]
```

## DFD Level 1

```mermaid
flowchart LR
  Student[Student] --> P1((1. Authenticate and authorize))
  Employer[Employer] --> P1
  Admin[Admin] --> P1
  P1 <--> D1[(Users and password reset token records)]
  P1 --> P2((2. Manage profiles and skills))
  P2 <--> D2[(Student/employer profiles and skill links)]
  P2 <--> F[(Avatar/logo files)]
  P1 --> P3((3. Browse internships and calculate matches))
  P3 <--> D3[(Internships and required skills)]
  P3 <--> D2
  P3 --> P4((4. Submit and manage applications))
  P4 <--> D4[(Applications and stored match scores)]
  P4 --> Student
  P4 --> Employer
  P1 --> P5((5. Admin management and reporting))
  P5 <--> D2
  P5 <--> D3
  P5 <--> D4
  P5 --> Reports[Analytics JSON and report API/PDF responses]
  Reports --> Admin
```

This DFD does not include notification delivery, audit-event processing, email reset delivery, or a separate reporting UI because those workflows are not wired into the current application.