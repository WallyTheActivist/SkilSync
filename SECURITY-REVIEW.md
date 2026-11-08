# Employer Email Verification Security Review

**Review date:** 2026-11-08
**Scope:** Read-only audit of employer email verification; no database, environment, or application changes were made as part of the audit.

## Findings

### Critical

None identified in the reviewed implementation.

### High

None identified in the reviewed implementation.

### Medium

1. **Production frontend URL can use plaintext HTTP.** `getEmailVerificationConfig` accepts both `http:` and `https:` for `FRONTEND_URL` in every environment. Verification tokens are included in the verification URL query string, so a publicly reachable HTTP deployment could expose a token in transit. Links are constructed from configured `FRONTEND_URL`, not the incoming request's `Host` header. See `server/src/services/emailVerificationService.ts` (URL validation and verification-link construction, approximately lines 40–47 and 86–87). The installation documentation calls for HTTPS in production, but the service does not enforce it.

### Low

None identified in the reviewed implementation.

## Controls reviewed

- Employer registration persists `emailVerified: false`, creates a verification token, and does not issue an authenticated session before verification (`server/src/controllers/authController.ts`).
- Login rejects unverified employers. Authentication middleware independently checks the current database verification state before allowing employer-only access (`server/src/controllers/authController.ts`, `server/src/middleware/auth.ts`).
- The verification token is generated from 32 cryptographically random bytes. The database stores a SHA-256 digest rather than the raw token. Verification checks expiry and atomically marks an unused token used within a transaction.
- Resend responses use a generic acknowledgement for unknown, verified, or non-employer accounts. A replacement token is delivered before prior unused tokens are invalidated; a delivery failure invalidates the candidate token and does not claim delivery succeeded.
- The verification endpoint and resend endpoint have route-specific rate limits. Registration uses the application's broader auth limiter in production; those broader limits are disabled in development.
- Verification links use the configured frontend URL. No SMTP credentials or raw verification tokens were found in application logs or API response bodies during review.
- The migration adds verification state with a false default, leaves existing employers unverified, and marks existing non-employer accounts verified to preserve their sign-in behavior (`server/prisma/migrations/20261108150000_employer_email_verification/migration.sql`).

## Migration and test status

Read-only Prisma status inspection reported the verification migration as pending for the configured development database (`server/prisma/dev.db`, from `server/.env`). It was not applied to that database. The test integration requires `SKILLSYNC_TEST_DATABASE_URL`; that variable was unset during the audit, so the integration test is skipped unless an isolated test database is configured. Do not treat a successful isolated migration from a different run as evidence that the current development database has been migrated.

The audited implementation has tests for registration/login state, token hashing, expiry and reuse, resend rotation, SMTP failures, generic resend behavior, and resend rate limiting. The following coverage was not found:

- Concurrent verification attempts and concurrent resend/verification interactions.
- Migration behavior against representative pre-existing student, administrator, and employer records.
- Explicit registration and verification endpoint rate-limit tests.
- Production rejection of HTTP frontend URLs and enforcement of SMTP transport security.

Tests were not run as part of this read-only audit.

## Manual testing recommendation

It is reasonable to configure a test SMTP sink and manually test against a separate, isolated database after applying the migration there. The current development database is not ready for the feature because its migration is pending; current local environment inspection also found no SMTP or frontend URL configuration. Use HTTPS for a production frontend URL and a TLS-protected SMTP relay for production. This review does not certify production readiness.
