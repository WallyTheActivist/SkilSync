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

## Database backup and restoration

The private GitHub repository protects committed source history. The source ZIP protects reconstructable source, lockfiles, migration history, and documentation. Neither contains the live database, uploaded files, or secret configuration. The separate SQLite database backup contains the database records and schema as a consistent SQLite snapshot; treat it as sensitive personal data.

The database script resolves the server's effective `DATABASE_URL` without displaying it. For the current SQLite configuration, a relative file URL is resolved from `server/prisma/`. It uses Python's built-in `sqlite3.Connection.backup()` online backup API, rather than copying the live database file. This API obtains a consistent snapshot while SQLite is active, including when WAL mode is used. It fails instead of falling back to a direct file copy.

Run the scripts on Windows with PowerShell, Python 3.7 or later (with its standard-library `sqlite3` module), Node.js, and the installed server npm dependencies. No extra Python or npm dependency is added. If a required tool is unavailable, the script stops with an error rather than copying the database directly.

Database archives are stored outside the project by default, under `C:\Projects\SkillSync-backups\database`. A custom destination can be supplied. The database archive is an unencrypted SQLite file; choose a protected, access-controlled destination (for example, encrypted removable storage or an approved encrypted backup service). Do not store it in GitHub or in the source ZIP folder. Keep more than one protected copy for recovery from device loss.

The Admin Backup & Recovery page invokes the same protected PowerShell/Python backup workflow. Its destination is server-controlled: by default it uses the database directory above; an optional `SKILLSYNC_BACKUP_DIRECTORY` environment variable may select another absolute directory outside the project. Admin-created backup metadata is stored atomically in `manifest.json` beside the backups. After the script succeeds, the service calculates and stores the backup file's SHA-256 digest. History retains a Passed validation only while the stored size and digest match the file and the script's explicit validation output was confirmed. A missing file, size mismatch, digest mismatch, or inability to read the file cannot be shown as Passed. Hash mismatches are not silently adopted as new metadata. Older records without a digest and backup files without usable metadata are Not verified; downloads of these files are refused until there is trusted metadata.

The SHA-256 value detects accidental or unrecorded content changes relative to the manifest; it is not a digital signature. An attacker who can replace both the backup and its manifest can create a consistent replacement. Keep the backup directory and manifest on access-controlled storage, and retain an independent protected copy.

If the final manifest write fails after the database file was created, the Admin request returns a generic failure and the record is changed to failed where the manifest remains writable. The backup file is not automatically deleted. If the storage failure also prevents writing the failed record, the earlier in-progress record may remain; it is never reported as a successful validation. Review the server diagnostics and manifest/storage health before retrying.

For downloads, the service opens the resolved file once, checks that the opened handle is a regular file, verifies its size and SHA-256 through that handle, and streams from the same handle. It also checks the path before and after opening and compares file identity where Windows reports it. The Windows runtime used for this implementation does not expose the `O_NOFOLLOW` open flag, so this narrows but cannot eliminate every race against an actor who can concurrently replace directory entries. Do not grant untrusted users write access to the backup directory; restrict it to the service account and trusted operators, avoid reparse points, and do not modify backups while they are being inspected or downloaded.

For Admin-created backups, the service generates a unique temporary filename, creates an empty file there with exclusive-create semantics, and passes that exact path to the PowerShell script. The script validates the path and the empty regular file before invoking the helper. A standalone script invocation creates its own unique empty temporary file exclusively. The SQLite helper accepts only that empty placeholder (or refuses the path if it is no longer empty). Service cleanup attempts to remove only the path the current operation successfully created; a temporary file belonging to a separately invoked script is not selected for cleanup. A timed-out process may still leave a partial temporary file; inspect it only after confirming the PowerShell/Python process has stopped.

For OneDrive status, `SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY` may identify a local sync folder. A detected local OneDrive folder, or a matching backup file found there, does not independently verify completion of cloud synchronization. The Admin page reports cloud synchronization as not independently verified because no cloud-provider verification is implemented.

### Investigate a stale Admin backup lock

The Admin backup service creates `.skillsync-database-backup.lock` in the configured backup directory using exclusive create (`wx`). The lock intentionally contains no owner or process metadata. It is removed after the backup operation finishes normally. If the server is forcibly terminated, the lock file can remain and subsequent requests correctly receive a conflict. The service does not remove locks based on age, and an old timestamp alone is not evidence that a lock is stale.

Before manually clearing a lock:

1. Stop the SkillSync server normally (for a development server, press `Ctrl+C` in its console; for a managed service, stop that specific service). Do not clear the lock while a backup request may still be running.
2. Locate the exact configured backup directory (`SKILLSYNC_BACKUP_DIRECTORY`, or `C:\Projects\SkillSync-backups\database` by default) and inspect the lock without changing it:

   ```powershell
   $backupDirectory = 'C:\Projects\SkillSync-backups\database'
   $lockPath = Join-Path $backupDirectory '.skillsync-database-backup.lock'
   Get-Item -LiteralPath $lockPath | Select-Object FullName, Length, LastWriteTimeUtc
   ```

3. Check for relevant remaining server or backup processes. Review the command lines and correlate process IDs with the server console/service you stopped; do not terminate unrelated processes:

   ```powershell
   Get-CimInstance Win32_Process |
     Where-Object {
       $_.Name -in @('node.exe', 'powershell.exe', 'python.exe', 'python3.exe') -and
       $_.CommandLine -match 'SkillSync|backup-database\.ps1|sqlite_database\.py'
     } |
     Select-Object ProcessId, ParentProcessId, Name, CommandLine
   ```

   If a known SkillSync process remains, stop that specific process gracefully through its owning console/service. Recheck that its backup child processes have exited. If process ownership is ambiguous, leave the lock in place and investigate with the operator; do not guess based on the lock age.

4. Only after confirming the SkillSync server and its backup child processes have stopped, preserve the lock for investigation by renaming it (rather than deleting it):

   ```powershell
   $staleLockPath = "$lockPath.stale-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
   Move-Item -LiteralPath $lockPath -Destination $staleLockPath
   ```

5. Restart the server and confirm the backup status/history endpoint is healthy. Do not start a new backup until the cause of the abandoned operation is understood. Keep the renamed lock file with incident notes; it contains no credentials.

Never delete or rename the lock while any server process could still be creating a backup. This procedure is manual by design; lock ownership is not guessed and no automatic stale-lock stealing is performed.

### Create a database backup

From PowerShell:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\backup-database.ps1
```

To select another protected destination outside the project:

```powershell
.\scripts\backup-database.ps1 -DestinationDirectory D:\ProtectedBackups\SkillSync\Database
```

The script creates a timestamped `.sqlite` file and refuses to overwrite an existing backup. It validates non-empty output, SQLite integrity, the tables represented by `server/prisma/schema.prisma`, Prisma migration metadata, and foreign-key integrity. The script reports the archive path and validation status without displaying database contents.

### Restore and test a database backup

Restore only to a new, separate database file. The destination directory must already exist and the destination file must not exist:

```powershell
Set-Location C:\Projects\SkillSync
New-Item -ItemType Directory -Path D:\SkillSync-Restore
.\scripts\restore-database.ps1 `
  -BackupPath D:\ProtectedBackups\SkillSync\Database\skillsync-database-<timestamp>.sqlite `
  -DestinationPath D:\SkillSync-Restore\dev-restored.db
```

The restore script validates the backup before restoring, refuses the configured application database and any existing destination, and writes first to a temporary file before placing the validated file at the requested destination. It then verifies SQLite integrity, expected schema tables, migration metadata, foreign keys, and matching per-table row counts. It does not change `server/.env` or switch the running application to the restored database.

To use a restored database later, an administrator must deliberately configure the intended recovered application environment's `DATABASE_URL` to the restored local SQLite file, following Prisma's SQLite URL format. First stop that application, preserve its current database, restrict access to the restored database, update only that recovered environment's private `.env`, and verify the configured path before starting it. Do not point the current application at a restore destination as part of this test.

### What the database backup does not include

- Uploaded avatars and logos remain under `server/uploads/` and need their own protected backup.
- Environment secrets and application configuration are not included.
- Database backups do not replace Prisma migration files or source backups.

Prisma migrations describe schema changes; they do not contain database records and cannot recreate users, applications, or other saved data. A successful backup is not proven until it has been restored to a separate destination and validated. Repeat restoration tests periodically and after backup-tool changes. Restore tests should compare non-sensitive validation metadata, never display actual records, and must not overwrite the live database.

## Uploaded-file backup and restoration

The application accepts JPEG, PNG, and WebP profile images up to 5 MB. It writes student avatars and employer logos locally under `server/uploads/avatars`; both are served through `/uploads`. The upload archive preserves paths relative to the project, including the `server/uploads/avatars` directory. The script discovers upload directories and creates a valid manifest-only archive if they are empty.

Uploads and the SQLite database are separate recovery components: the database stores the profile path references while the archive stores file bytes. Back up both at compatible recovery points. Upload archives are ordinary ZIP files and are **not encrypted by this script**; uploaded images may identify users, so store the archives only on access-controlled protected storage.

The upload manifest is inside the ZIP and records relative paths, file sizes, and SHA-256 hashes. The script validates the ZIP and manifest before publishing a timestamped archive. The default destination is outside the project at `C:\Projects\SkillSync-backups\uploads`.

Create an upload backup from PowerShell:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\backup-uploads.ps1
```

Or specify a protected destination outside the project:

```powershell
.\scripts\backup-uploads.ps1 -DestinationDirectory D:\ProtectedBackups\SkillSync\Uploads
```

Restore into a new destination directory (it must not already exist):

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\restore-uploads.ps1 `
  -BackupPath D:\ProtectedBackups\SkillSync\Uploads\skillsync-uploads-<timestamp>.zip `
  -DestinationPath D:\SkillSync-Restore
```

The restored tree is under `D:\SkillSync-Restore\server\uploads\...`. The restore script checks archive integrity and manifest hashes before extracting to a staging directory and moving it to the new destination. It will not overwrite a destination and does not restore into the live application. After independently reviewing the recovered files and database together, an administrator can use an application recovery copy and manually place the upload tree at its intended `server\uploads` location while preserving the original data.

## Configuration backup and restoration

Environment files contain database connection details, JWT signing secrets, and other private settings. The configuration backup script discovers actual `.env` and `.env.*` files (excluding `.env.example` templates) while skipping dependencies and build output. In this checkout, the only actual environment file found was `server/.env`; there is no client environment file. Ordinary runtime configuration and code such as `server/prisma/schema.prisma`, server startup/auth code, package manifests, and client build configuration are tracked in Git and included in the source backup.

Configuration backups use portable **AES-256-GCM authenticated encryption**. A key is derived from a passphrase using Node.js `scrypt` (N=32768, r=8, p=1) with a fresh random salt and nonce. The encrypted archive and its manifest are validated before the backup is published. The ZIP is created in memory; no plaintext configuration archive is written to disk. The script prompts securely for a passphrase twice, requires at least 16 UTF-8 bytes, and never saves it. Use a unique strong passphrase and retain it in a trusted password manager: **without that passphrase, the backup cannot be recovered**. The format is portable to another computer with Node.js and Python available; Windows DPAPI is not used.

The encrypted configuration archive is stored separately from source, database, and upload backups. Its default destination is `C:\Projects\SkillSync-backups\configuration`; specify another protected destination outside the project when needed:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\backup-config.ps1
```

```powershell
.\scripts\backup-config.ps1 -DestinationDirectory D:\ProtectedBackups\SkillSync\Configuration
```

The encrypted archive contains the environment files and an encrypted manifest with relative filenames and validation metadata, but no configuration values are printed. Never commit `.sscfg` archives or actual `.env` files to GitHub. Encryption does not make it safe to publish the archive; protect it from deletion, unauthorized access, and passphrase loss.

Restore the encrypted configuration only into a new, separate directory. The script prompts for the passphrase and refuses an existing destination:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\restore-config.ps1 `
  -BackupPath D:\ProtectedBackups\SkillSync\Configuration\skillsync-config-<timestamp>.sscfg `
  -DestinationPath D:\SkillSync-Recovery-Config
```

The script authenticates and validates the archive, then verifies each restored file hash. It does not replace the live `.env`. On a different computer, first recover the source to a separate project directory; restore configuration to a separate recovery directory; compare filenames with that project's `.env.example`; and manually copy only the needed values into a newly created, access-controlled `.env` for that recovered project. Keep the recovered `.env` out of Git and do not overwrite an existing environment file without first preserving it and confirming the target project and database. Do not copy `DATABASE_URL` from an old environment unless it is intentionally correct for the recovered machine.

Configuration files are backed up separately because the source repository and source ZIP intentionally exclude secrets, while a database backup covers records and schema—not runtime secrets. Upload archives, in turn, contain user files but no database records or configuration. Each component therefore requires its own access controls and validated restore procedure.

## Coordinated backups, status, retention, and scheduling

The coordinator writes each run under `<BackupRoot>\runs\<run-id>\`, with separate `source`, `database`, `uploads`, and `configuration` directories. The default root is `C:\Projects\SkillSync-backups\automated`; choose a protected destination outside the project when running it elsewhere. Each run has machine-readable `run.json` metadata. Per-component results include file counts, sizes, artifact hashes, and the component script's validation result. Logs and attempt status are stored separately under `%LOCALAPPDATA%\SkillSync\backup-status`; they contain status and safe error summaries, not configuration values or database records.

Run all components interactively so the configuration script can prompt for its encryption passphrase:

```powershell
Set-Location C:\Projects\SkillSync
.\scripts\run-backup.ps1 -BackupRoot D:\ProtectedBackups\SkillSync\automated
```

The coordinator reports a run as `complete` only when all four components succeed and their artifacts are recorded. In noninteractive mode it deliberately does not request or store a configuration passphrase; configuration is marked `manual_required`, the run is `partial`, and the command exits nonzero:

```powershell
.\scripts\run-backup.ps1 -BackupRoot D:\ProtectedBackups\SkillSync\automated -NonInteractive
```

The noninteractive form is appropriate for source, database, and upload automation, but it does not create a complete four-component recovery point. The configuration backup still requires a separate interactive operation. A nonzero result must be investigated; do not treat a partial or failed run as a successful backup.

Check the latest attempt and the existing run artifacts without displaying their contents:

```powershell
.\scripts\backup-status.ps1 -BackupRoot D:\ProtectedBackups\SkillSync\automated
```

Status counts a run as verified complete only after checking each component's artifact paths, sizes, and SHA-256 hashes. It also checks the artifacts for components marked successful in the latest attempt, even if the overall run is partial. The status command reads local attempt history and the selected backup root; an unavailable destination is reported as such, not as a successful backup.

### Optional Windows Task Scheduler setup

The task setup script supports a preview that does not register anything:

```powershell
.\scripts\install-backup-schedule.ps1 `
  -BackupRoot D:\ProtectedBackups\SkillSync\automated `
  -DailyTime '02:00' `
  -WhatIf
```

To actually register the task, rerun without `-WhatIf`. Registration is an explicit administrator/operator action and is not performed by this documentation. The task runs as the current user only while that user is logged in, starts missed work when possible, and skips overlapping runs. It invokes the noninteractive coordinator, so configuration is marked `manual_required` and scheduled runs remain partial until a secure unattended configuration-encryption method is designed and tested. There is no unattended passphrase or plaintext fallback.

For an actual scheduler registration test without running a backup, give the test task a unique name, choose a time safely in the future, and use `-TestAction`. That action only starts PowerShell and exits successfully. Remove the named test task afterward:

```powershell
$testTask = "SkillSync scheduler test $([guid]::NewGuid().ToString('N'))"
$testTime = (Get-Date).AddMinutes(10).ToString('HH:mm')
.\scripts\install-backup-schedule.ps1 `
  -BackupRoot (Join-Path $env:TEMP $testTask) `
  -DailyTime $testTime `
  -TaskName $testTask `
  -TestAction
Get-ScheduledTask -TaskName $testTask -TaskPath '\'
.\scripts\uninstall-backup-schedule.ps1 -TaskName $testTask -ConfirmRemoval
```

The install and uninstall scripts default to the production task name, but accept an exact task name for isolated tests; wildcard names and task paths are rejected. Do not use `-TestAction` with the production task name.

Preview retention before any deletion:

```powershell
.\scripts\cleanup-backups.ps1 `
  -BackupRoot D:\ProtectedBackups\SkillSync\automated `
  -DryRun
```

Retention considers only complete runs whose metadata and every recorded artifact pass validation. It keeps the newest run in each of the latest 7 daily, 4 weekly, and 3 monthly calendar buckets, as well as the latest complete run. Partial, failed, and unrecognized directories are not deletion candidates. A run marked `running`, malformed metadata, or a complete run with missing or corrupted artifacts stops cleanup without deleting candidates. Backup roots and run trees containing symbolic links or junctions are rejected. If and only if the preview is understood and the operator explicitly authorizes deletion, the same policy can be applied with:

```powershell
.\scripts\cleanup-backups.ps1 `
  -BackupRoot D:\ProtectedBackups\SkillSync\automated `
  -ConfirmDeletion
```

The deletion option is intentionally explicit. Do not run it until the backup root is available, metadata validates, and the previewed candidates are acceptable. Retention does not delete incomplete runs, so those may require separate, careful manual review. The scripts use an operating-system mutex, not a backup file or lock file that could be mistaken for a successful backup. No cleanup is run automatically.

### Storage and operational limits

The source ZIP and configuration archive have their own protection mechanisms, but the SQLite and uploaded-file archives are not encrypted by their scripts. Encryption-at-rest for the backup destination has not been verified. Store all backup components on access-controlled, encrypted storage and keep an independent copy on a different device or approved storage service. The default sibling folder on the same machine is not an independent disaster-recovery copy. Do not put database, upload, run, or configuration backups in GitHub or in the source archive.

## Verify recovery

- Confirm the archive opens and contains the source, lockfiles, Prisma schema, migrations, and documentation.
- Confirm actual `.env` files, SQLite files, uploads, `node_modules`, and build output are absent from the source archive.
- On the new machine, run `npm ci` in both applications and `npx prisma generate` in the server.
- For an empty local database only, apply migrations and check `http://localhost:5000/api/health`.
- Run the existing test commands documented in `docs/technical/installation.md`.
- Restore database records and uploads only through their separately verified backup procedures.

## Git and remote repository status

The private GitHub repository contains committed source and migration history, not the live SQLite database or its records. `.gitignore` excludes environment files, database files and sidecars, uploads, dependencies, and generated output. Keep database backups in separate protected storage, never stage them, and confirm ignored paths before committing future source changes.
