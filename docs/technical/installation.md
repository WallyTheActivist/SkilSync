# Installation Guide

This guide installs the existing SkillSync application locally. It does not configure a production deployment or a PostgreSQL/Supabase backend.

## Prerequisites

- Node.js 18 or later and npm.
- PowerShell or another terminal.
- Network access for installing npm dependencies.

## Install Dependencies

From the project root:

```powershell
Set-Location server
npm install

Set-Location ..\client
npm install
```

## Configure the Server

From `server/`, create a local environment file from the safe template:

```powershell
Copy-Item .env.example .env
```

Edit `server/.env` locally and replace the `JWT_SECRET` placeholder with a random value; never commit or share the `.env` file. `JWT_SECRET` is required in every environment and must be at least 32 characters in production. `JWT_EXPIRES_IN` defaults to `7d`. The SQLite file path is resolved relative to the Prisma schema in `server/prisma/`.

### Employer email verification

Employer registration requires SMTP delivery configuration. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and `FRONTEND_URL` in the local `server/.env`. For a development test inbox, use a provider such as Mailtrap Email Sandbox and copy the SMTP host, port, username, and password from that sandbox into `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`. Do not use real customer addresses or commit provider credentials. `SMTP_SECURE=true` selects implicit TLS (commonly port 465); `false` uses a plaintext connection in development unless the server negotiates STARTTLS. SMTP certificates are always validated; certificate validation is never disabled. `EMAIL_VERIFICATION_TTL_HOURS` defaults to 24.

Production must use a trusted SMTP relay with TLS and credentials stored in the deployment's secret manager. With `SMTP_SECURE=true`, the connection uses implicit TLS; with `false`, the server requires STARTTLS and fails delivery if TLS cannot be negotiated. In either mode, certificate validation remains enabled. Email verification delivery rejects any production `FRONTEND_URL` that is not HTTPS; local development may use localhost HTTP. Verification links use only this configured frontend URL, never the incoming request Host header. An employer account is created unverified and cannot log in or use employer routes until the email link is used. If SMTP is missing or insecure production configuration is supplied, registration reports an explicit configuration error; a delivery outage after account creation requires the user to request a resend when delivery is available.

The migration marks existing employer accounts unverified so each must prove email ownership at their next login. Existing non-employer accounts remain verified. The migration adds columns/tables only; apply it with `npx prisma migrate deploy` after taking the deployment's normal backup.

## Generate the Client and Apply Migrations

```powershell
Set-Location server
npx prisma generate
npx prisma migrate deploy
```

Seeding is an explicit command and is not run when the server starts. It now refuses to run unless `NODE_ENV` is `development`, `DATABASE_URL` is a local SQLite URL, and `SKILLSYNC_ALLOW_DEMO_SEED=true`. It also requires a distinct email and a unique password for each of the five employer, two student, and one administrator demo accounts.

To seed a disposable local SQLite database, edit `server/.env` and set `SKILLSYNC_ALLOW_DEMO_SEED=true`. Replace every `DEMO_*_EMAIL` placeholder with an email you control and every `DEMO_*_PASSWORD` `TODO` placeholder with a unique, private password of at least 12 characters. Do not reuse production credentials or share/commit `.env`. Then run:

```powershell
Set-Location C:\Projects\SkillSync\server
npm run seed
```

The seed command creates sample records and never prints account credentials. Do not run it against a shared or production database. After seeding, sign in with the locally configured credentials.

## Start the Application

Terminal 1:

```powershell
Set-Location C:\Projects\SkillSync\server
npm run dev
```

Terminal 2:

```powershell
Set-Location C:\Projects\SkillSync\client
npm run dev
```

Vite serves the client at `http://localhost:5173`, proxies `/api` and `/uploads` to the server at `http://localhost:5000`, and prints the actual client URL when it starts. No `VITE_API_URL` setting is used by the current API client.

Verify the API with `http://localhost:5000/api/health`.

## Useful Commands

From `server/`:

```powershell
npm run build
npm test
npm run test:unit
npm run test:integration
npx prisma studio
```

From `client/`:

```powershell
npm run build
npm run lint
```

## Configuration and Deployment Notes

- Current `server/prisma/schema.prisma` uses SQLite. PostgreSQL/Supabase support requires provider-specific schema and migrations; changing only `DATABASE_URL` is not sufficient.
- The client API base is `/api`; use the existing Vite proxy in development.
- Set `CLIENT_URL` to the exact frontend origin used by the server's CORS and unsafe-request origin checks.
- The server does not send password-reset email. The route stores a hashed token but does not expose it in the response.
- Employer verification tokens are random, stored only as SHA-256 hashes, and expire after the configured verification lifetime. Resend requests are rate limited and return a non-enumerating response.
- The server uploads directory is local disk storage. A persistent upload volume or separately hosted file service is not configured here.
- Do not run `prisma migrate reset` against data that must be retained.