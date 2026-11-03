# API Reference

## Conventions

- API base path: `/api`; local Vite development proxies this path to `http://localhost:5000`.
- JSON responses commonly use `{ success, message?, data? }`. PDF report requests return `application/pdf` attachments.
- Browser authentication uses the `ss_token` HttpOnly cookie. Bearer JWTs are also accepted by authentication middleware.
- Roles are enforced by server middleware: `STUDENT`, `EMPLOYER`, and `ADMIN`. `Public` indicates no role middleware; write requests are still subject to origin checks and validation where configured.
- Most JSON routes return 400 for invalid input, 401 for missing/invalid authentication, 403 for role/origin denial, 404 for missing resources, 409 for duplicate registration/application, and 429 when rate limited. Error responses do not include stack traces.

## Authentication: `/api/auth`

| Method and path | Access | Purpose and notes |
|---|---|---|
| `POST /api/auth/register` | Public | Creates a student or employer account. Public registration cannot create admins. Sets an HttpOnly session cookie. |
| `POST /api/auth/login` | Public | Verifies the password and sets the session cookie. |
| `POST /api/auth/logout` | Public | Clears the session cookie. |
| `GET /api/auth/me` | Authenticated | Returns the current user and profile. |
| `POST /api/auth/forgot-password` | Public | Accepts an email and returns a non-enumerating acknowledgement. A token hash is stored when the account exists; no email provider is configured, and no raw token is returned. |
| `POST /api/auth/reset-password` | Public | Consumes a valid unexpired reset token and updates the password. The token delivery flow is not configured. |

## Student: `/api/student`

All routes require `STUDENT` authentication.

| Method and path | Purpose |
|---|---|
| `GET /api/student/profile` | Read own profile and skills. |
| `PUT /api/student/profile` | Update own profile fields; validates supported text, number, and URL fields. |
| `POST /api/student/profile/avatar` | Upload an avatar as multipart field `avatar`; JPEG, PNG, or WebP, maximum 5 MB. |
| `GET /api/student/readiness-score` | Calculate readiness and update `StudentProfile.readinessScore`. |
| `GET /api/student/skill-gap` | Return missing/weak skills, recommendations, and strong skills. |
| `GET /api/student/recommendations` | Regenerate and return rule-based recommendations. Existing recommendations for that student are deleted and recreated. |
| `PATCH /api/student/recommendations/:id/complete` | Mark the student's own recommendation complete. |

## Skills: `/api/skills`

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/skills` | Public | List the skill catalogue. |
| `GET /api/skills/my-skills` | Student | List own skills. |
| `POST /api/skills/my-skills` | Student | Add a skill and proficiency/experience. |
| `PUT /api/skills/my-skills/:id` | Student | Update own skill proficiency, experience, or certification URL. |
| `DELETE /api/skills/my-skills/:id` | Student | Remove own skill. |

## Internships: `/api/internships`

| Method and path | Access | Purpose and query fields |
|---|---|---|
| `GET /api/internships` | Public | Browse active postings; optional `search`, `industry`, `isRemote`, `page`, and `limit`. |
| `GET /api/internships/:id` | Public | Read a posting by ID. |
| `GET /api/internships/recommended` | Student | Return top active internship matches for the current student. |
| `GET /api/internships/:internshipId/match-score` | Student | Calculate the current student's score and skill breakdown for a posting. |

## Applications: `/api/applications`

All routes require `STUDENT` authentication and operate on the current student's applications.

| Method and path | Purpose |
|---|---|
| `POST /api/applications` | Apply using `internshipId` and optional `coverLetter`; posting must be active and duplicate applications are rejected. |
| `GET /api/applications/my-applications` | List own applications. |
| `PATCH /api/applications/:id/withdraw` | Withdraw an owned application unless its status is finalized. |

## Employer: `/api/employer`

All routes require `EMPLOYER` authentication; posting/applicant operations are scoped to the current employer.

| Method and path | Purpose |
|---|---|
| `GET /api/employer/dashboard/stats` | Employer posting and application summary. |
| `GET /api/employer/profile` | Read own company profile. |
| `PUT /api/employer/profile` | Update own company profile. |
| `POST /api/employer/profile/logo` | Upload company logo using multipart field `avatar`; JPEG, PNG, or WebP, maximum 5 MB. |
| `GET /api/employer/internships` | List own postings; optional status/page/limit filters. |
| `POST /api/employer/internships` | Create a posting and required-skill links. |
| `PUT /api/employer/internships/:id` | Update own posting and, when supplied, its required-skill links. |
| `DELETE /api/employer/internships/:id` | Delete own posting. |
| `GET /api/employer/internships/:id/applicants` | List applicants for own posting; optional status filter; results are ordered by match score. |
| `PATCH /api/employer/applications/:id/status` | Update status/notes for an application to own posting. |

The status accepted by this endpoint is one of `PENDING`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `OFFERED`, `ACCEPTED`, or `REJECTED`. Student withdrawal is a separate application endpoint.

## Administration: `/api/admin`

All routes require `ADMIN` authentication.

| Method and path | Purpose |
|---|---|
| `GET /api/admin/stats` | Platform counts, status breakdowns, recent registrations, top requested skills, and readiness distribution. |
| `GET /api/admin/analytics` | Top internships/skills, match-score aggregates, and a 30-day application trend. This powers the current Admin Analytics page. |
| `GET /api/admin/students` | Search and paginate student accounts. |
| `GET /api/admin/employers` | Search and paginate employer accounts. |
| `DELETE /api/admin/users/:id` | Delete a non-admin user. Admin accounts cannot be deleted through this endpoint. |
| `GET /api/admin/internships` | Search/filter and paginate internships. |
| `PATCH /api/admin/internships/:id` | Update selected internship status/title/description. |
| `DELETE /api/admin/internships/:id` | Delete an internship. |
| `GET /api/admin/applications` | Filter and paginate applications. |
| `GET /api/admin/skills` | Search/filter the skills catalogue. |
| `POST /api/admin/skills` | Create a skill. |
| `PUT /api/admin/skills/:id` | Update a skill. |
| `DELETE /api/admin/skills/:id` | Delete a skill. |

## Reports: `/api/reports`

All routes require `ADMIN` authentication. The optional query `export=pdf` requests a PDF for report endpoints that return a single report; without it, responses are JSON.

| Method and path | Purpose |
|---|---|
| `GET /api/reports/dashboard` | Combined report summary data. |
| `GET /api/reports/student-readiness` | Readiness records for all students. |
| `GET /api/reports/student-readiness/:studentId` | Readiness record for one student profile ID. |
| `GET /api/reports/internship-match` | Application-based match report. |
| `GET /api/reports/application-statistics` | Application statuses, acceptance rate, top internships, and decision-time field. The current average decision time is a fixed placeholder of 7 days. |
| `GET /api/reports/skills-demand` | Current counts of internship skill links and student skill links; trend is a current-count heuristic, not a historical time series. |

These report routes are implemented in the API. The client router currently has `/admin/analytics`; it does not register a dedicated report page.

## Health

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/health` | Public | Return API status, timestamp, and version. |

Uploaded avatar/logo assets are served as static files under `/uploads/` by Express; the Vite development proxy forwards this path to the server.