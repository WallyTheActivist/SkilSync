# SkillSync Testing Strategy

## Purpose and Scope

This plan adds repeatable coverage around the existing SkillSync React/Vite client, Express API, Prisma data layer, and matching service. It does not replace application architecture or claim that unexecuted browser/database workflows have passed.

## Existing Test Stack

| Layer | Current tooling | Current automated coverage |
|---|---|---|
| Server unit | Node.js built-in `node:test` and `node:assert/strict` | Password hash verification and matching/readiness/gap/recommendation calculations. Prisma is stubbed for matching unit cases. |
| Server HTTP integration | Node `fetch` against in-memory Express apps | Security middleware, authentication, registration/profile validation, and application cases. Some controller cases use Prisma delegate stubs; these are not database tests. |
| Database integration | Prisma Client against an explicitly configured disposable SQLite database | Opt-in tests cover registration persistence/normalization and user/profile/skill/internship/application relations with persisted matching. They are skipped unless `SKILLSYNC_TEST_DATABASE_URL` is set. |
| Client unit/component | Node.js built-in `node:test` for `.mjs` helpers | Identity-field normalization, shared password policy, profile payloads, auth requests, validation errors, and employer profile payloads. No component or browser test runner is installed. |
| System / end-to-end | Documented procedures | Requires a running client/API and synthetic test data. All such cases are pending until executed and recorded. |

## Repository-Specific Constraints

- The current Prisma schema uses `provider = "sqlite"`. PostgreSQL/Supabase tests cannot run against this generated client/schema as-is. A separate PostgreSQL migration/configuration and an isolated database or Supabase test project are prerequisites; SQLite results must not be represented as PostgreSQL results.
- Database integration tests refuse non-SQLite URLs and require `test` in the database path as a basic guard. Never point them at a developer, staging, or production database.
- The client has no automated browser runner. The workflow cases below are written for manual execution in a browser; automation with Playwright is a later tooling decision, not silently assumed.
- Test accounts use `@skillsync.test`, synthetic names, and non-production passwords. Never use personal or production data.

## Running Tests

From `server/`:

```powershell
npm test
npm run test:unit
npm run test:integration
```

`npm test` builds the TypeScript server and discovers all Node tests. Database integration tests report skipped when no dedicated test database is configured.

To opt into the SQLite integration test, use a disposable test file. Prisma resolves the relative SQLite file path from the schema location under `server/prisma/`:

```powershell
Set-Location server
$env:SKILLSYNC_TEST_DATABASE_URL = "file:./skillsync_test.db"
$env:DATABASE_URL = $env:SKILLSYNC_TEST_DATABASE_URL
npx prisma migrate deploy
npm run test:integration
```

Do not commit the resulting database file. After testing, remove only that explicitly named test database when no process is using it.

From `client/`, run the helper tests and production typecheck/build:

```powershell
Set-Location client
npm test
npm run build
```

There is no automated browser/component test runner; UI behavior has not been browser-verified by these commands.

## Test Design by Layer

### Unit

- Exercise deterministic algorithms and policy helpers independently from Express and persistence.
- Current matching unit tests stub only the Prisma delegate calls and assert algorithm outputs against fixed synthetic skill records.
- Keep expected values tied to the existing matching formula. When the product formula changes, update the formula specification and test cases together.
- Password complexity and bcrypt length boundaries are tested in the shared client helper and backend policy helper. In-memory HTTP tests cover registration for student and employer roles and password reset rejection; database-backed registration persistence remains opt-in.
- Client identity helper tests cover trimmed international names, invalid names, optional university omission, and malformed supplied university values.

### Integration

- Exercise real Express routers and middleware over HTTP for authentication, authorization, CSRF/origin handling, request validation, and application status/ownership rules.
- Mock Prisma only where the test targets controller/middleware behavior without needing persistence. Mark those tests as HTTP/controller integration with mocked storage, not database integration.
- Use the opt-in Prisma tests for actual registration/account persistence and model relations/matching against a disposable database.
- Frontend-to-backend cases must use the real Vite client/API pair and synthetic accounts; the current codebase does not yet automate those browser sessions.
- Before adding PostgreSQL/Supabase cases, provision an isolated provider-compatible test schema and verify its migrations. The current SQLite test is not a substitute.

### System

- Execute complete role-based workflows in the browser with the API running and an isolated seeded database.
- Record build/version, browser, synthetic role/account, exact data, observed result, pass/fail/blocked status, and redacted evidence.
- Do not fill Actual Result or Status with anticipated outcomes. Keep them `Pending / Not executed` until observed.

## Data and Isolation

Shared synthetic records live in `server/tests/fixtures/scenario.cjs`. Cases use UCT/Cape Town examples to resemble the configured South African product data without identifying a real person. Automated database tests use unique suffixes and clean up by the test-owned IDs. Manual system tests should reset only a dedicated test database.

## Coverage Gaps to Track

- PostgreSQL/Supabase is not the current Prisma provider and has no executed coverage.
- No real browser/client-to-API end-to-end test is configured.
- Database-backed tests cover registration persistence and matching-domain relations, not the complete profile/application/employer/admin workflows.
- Upload validation, reset-password delivery, report exports, and all system cases need additional automated or observed manual execution.
- Coverage percentages are not reported; no coverage instrumentation is configured.

## Result Recording

Use `docs/TEST_CASES.md` as the case register. Keep actual outcomes distinct from expected outcomes, add a dated execution record in Notes when rerunning, and record defects by ID rather than changing a failed result to pass after a code change without rerunning it.