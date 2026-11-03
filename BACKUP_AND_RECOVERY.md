# SkillSync Application Backup and Recovery

This procedure protects the reconstructable application source. It does **not** back up the live database, uploaded files, or secret configuration values.

## What the source archive contains

The timestamped ZIP preserves project paths and includes the frontend and backend source, tests, package manifests and lockfiles, Prisma schema and migration history, project documentation, `.gitignore`, and the placeholder-only `server/.env.example`.

The archive excludes:

- All `.env` files except `.env.example`, private keys, and local npm credentials.
- SQLite databases and SQLite sidecar files.
- `node_modules`, generated build output, test output, logs, and temporary files.
- `.git` and local IDE metadata.
- `server/uploads` and any other directory named `uploads`.
- Backup directories and generated backup archives.

This means the source archive cannot recover database records, actual uploads, or private environment values. Those need separate protected backups.

## Where source archives are stored

By default, the script writes archives to the `SkillSync-backups` folder next to the project folder. For example, a project at `C:\Projects\SkillSync` writes to `C:\Projects\SkillSync-backups`.

Each archive is named `skillsync-source-<timestamp>.zip`. Existing archives are never overwritten. The default destination is outside the project so a backup cannot accidentally include itself. Copy completed archives to a separate, access-controlled device or storage service for protection against loss of the development machine. Do not make a public repository or upload archives containing sensitive data.

## Create a source backup

From PowerShell:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\backup-source.ps1
```

To select another destination outside the project:

```powershell
.\scripts\backup-source.ps1 -DestinationDirectory D:\ProtectedBackups\SkillSync
```

The script validates that required source and documentation files are present, checks that excluded secrets/data and generated directories are absent, reads every ZIP entry to detect archive corruption, and refuses to replace an archive with the same name.

## Reconstruct the application on another machine

1. Copy the ZIP to the new machine and extract it to a new, empty folder. For example:

   ```powershell
   Expand-Archive -LiteralPath D:\ProtectedBackups\SkillSync\skillsync-source-<timestamp>.zip `
     -DestinationPath C:\Projects\SkillSync-Recovered
   ```

2. Install a supported Node.js version (18 or later) and npm.

3. Create a local server configuration from the safe template:

   ```powershell
   Copy-Item C:\Projects\SkillSync-Recovered\server\.env.example `
     C:\Projects\SkillSync-Recovered\server\.env
   ```

   Edit `server\.env` locally. Replace `JWT_SECRET` with a newly generated random value of at least 32 characters. Keep this file private and out of Git and source archives. Configure `DATABASE_URL` for the intended local database. The example uses a local SQLite database; it does not restore any records.

4. Install the exact locked dependencies and generate Prisma's client:

   ```powershell
   Set-Location C:\Projects\SkillSync-Recovered\server
   npm ci
   npx prisma generate
   Set-Location ..\client
   npm ci
   ```

5. To create a **new, empty local database** from the checked-in migrations, configure `DATABASE_URL` in the local server `.env`, then run:

   ```powershell
   Set-Location C:\Projects\SkillSync-Recovered\server
   npx prisma migrate deploy
   ```

   This applies schema migrations; it does not restore user, internship, or application records. Do not point setup commands at a database containing records you need to preserve.

6. Start the server and client in separate PowerShell windows:

   ```powershell
   Set-Location C:\Projects\SkillSync-Recovered\server
   npm run dev
   ```

   ```powershell
   Set-Location C:\Projects\SkillSync-Recovered\client
   npm run dev
   ```

   The Vite development server proxies API and upload requests to the local server. Confirm the API responds at `http://localhost:5000/api/health`.

## Configuration recovery

The archive contains only variable names and safe placeholders. Recover actual deployment values from the owner's secure password manager or secret store, then recreate the local `.env` file. The seed account settings in `.env.example` use non-credential placeholders and are not usable until deliberately replaced. Do not copy secrets into the source archive, Git history, screenshots, logs, or presentation materials. If the original secret is unavailable, generate a new one and update the intended environment through its normal secure configuration process.

## Database recovery (separate procedure)

Database backup and restoration are **not implemented in this phase**. `server/prisma/dev.db` and its possible `-wal`/`-shm` sidecars are deliberately excluded. Migrations can create an empty database but cannot recover records.

Do not restore a live SQLite database by copying only its main file while the application may be writing to it. A later database-backup procedure must use a WAL-aware SQLite online backup method and verify restoration against an isolated database before replacing any working database. Do not run destructive migrations or resets as a substitute for restoring data.

## Uploaded-file recovery (separate procedure)

Uploaded avatar and logo files are stored under `server/uploads/avatars` and are excluded from this source archive. Back up that directory separately to protected storage and restore its contents to the same relative path in the recovered server. The database may contain paths to these files, so restore the corresponding database and upload backup from a consistent recovery point. The uploads folder was empty when this backup foundation was prepared; future uploads need their own backup.

## Verify recovery

- Confirm the archive opens and contains the source, lockfiles, Prisma schema, migrations, and documentation.
- Confirm actual `.env` files, SQLite files, uploads, `node_modules`, and build output are absent from the source archive.
- On the new machine, run `npm ci` in both applications and `npx prisma generate` in the server.
- For an empty local database only, apply migrations and check `http://localhost:5000/api/health`.
- Run the existing test commands documented in `docs/technical/installation.md`.
- Restore database records and uploads only through their separately verified backup procedures.

## Git and remote repository status

The project has a local `.gitignore` to protect secrets, databases, uploads, dependencies, and generated files. No commit or remote push is part of this procedure. A private remote may be configured by the project owner later; review `git status` and confirm excluded files are ignored before making an initial commit.
