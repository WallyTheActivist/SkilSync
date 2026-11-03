# Technical Documentation Index

## Scope

SkillSync currently consists of a React 18 + TypeScript/Vite client and an Express 4 + TypeScript API. Prisma is the data-access layer and the checked-in Prisma schema targets SQLite. The diagrams and descriptions below represent this implementation, not a proposed production architecture.

## Documents

| Document | Contents |
|---|---|
| [Architecture and diagrams](architecture.md) | System architecture, use cases, conceptual class diagram, authentication/application sequences, application activity, DFD Level 0 and Level 1 |
| [Database schema and ERD](database.md) | Current Prisma models, mapped table names, relationships, constraints, indexes, and schema-only models |
| [API reference](api.md) | Routes registered by the Express application, role access, request notes, and implemented response behaviors |
| [Installation guide](installation.md) | Local prerequisites, environment, migrations, seed data, and startup steps |
| [User manual](user-manual.md) | Workflows available to students, employers, and administrators, including current limitations |
| [Developer and operations manual](developer-manual.md) | Source layout, request lifecycle, security boundaries, commands, and implementation status |

For the source archive and recovery procedure, see [Backup and Recovery](../../BACKUP_AND_RECOVERY.md).

## Implementation Status

Implemented workflows include student/employer registration and login, student profile and skill management, internship browsing and matching, applications, employer internship/applicant management, admin management/analytics, and admin report API/PDF export.

Current limitations relevant to this documentation:

- The client has an Admin Analytics page. There is no registered Reports page in the client router; reporting is exposed by the admin-only API.
- The password-reset API stores hashed, expiring tokens, but no email delivery provider is configured and the API does not return raw tokens.
- `Notification`, `AuditLog`, `StudentReadinessMetric`, and `InternshipMatchMetric` are Prisma models. No notification route, automatic audit writes, or metric-model refresh workflow is wired into the current server code.
- `Application.resumeUrl` is a schema field; no resume upload route is registered.
- The schema is SQLite-only. PostgreSQL/Supabase deployment and migration compatibility are not implemented by the checked-in datasource/migrations.

For exact behavior, refer to `server/src/routes`, `server/src/controllers`, `server/src/services`, `client/src/App.tsx`, and `server/prisma/schema.prisma`.