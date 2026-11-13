import { execFile } from 'child_process';
import { constants as fsConstants } from 'fs';
import fs, { type FileHandle } from 'fs/promises';
import path from 'path';
import os from 'os';
import { createHash, randomUUID } from 'crypto';

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const manifestName = 'manifest.json';
const backupFilenamePattern = /^skillsync-database-\d{8}-\d{6}-\d{3}\.sqlite$/i;
const validationOutput =
  'Validation: SQLite integrity passed; expected Prisma tables and all checked-in migrations present; foreign keys valid.';
const processTimeoutMs = 180_000;
const safeValidationDetails = new Set([
  'Backup operation is in progress.',
  'The backup process failed; validation was not accepted.',
  'The backup process did not report a recognized backup file.',
  'The reported backup file was outside the configured backup directory.',
  'The backup file was not created.',
  'The reported backup is not a regular file.',
  'SQLite integrity, Prisma schema, checked-in migrations, and foreign-key validation passed.',
  'Validation output was missing or unrecognized; validation was not confirmed.',
  'No confirmed validation metadata is available for this backup.',
  'Backup file size does not match stored metadata; validation failed.',
  'Backup SHA-256 does not match stored metadata; validation failed.',
  'No SHA-256 metadata is available; backup integrity is not verified.',
  'Backup SHA-256 could not be verified; validation is not verified.',
  'Backup file is missing; validation is not verified.',
  'The backup operation failed before validation completed.',
  'The backup process completed, but its final metadata could not be saved.',
  'Backup metadata could not be saved; validation is not considered successful.',
]);

export type BackupValidationStatus = 'passed' | 'failed' | 'unknown';
export type BackupCreationResult = 'running' | 'succeeded' | 'failed' | 'unknown';
export type CloudSynchronizationStatus =
  | 'not_configured'
  | 'configured_but_unavailable'
  | 'local_sync_folder_detected'
  | 'backup_copied_to_sync_folder'
  | 'not_independently_verified';

export interface BackupRecord {
  id: string;
  filename: string | null;
  sha256?: string | null;
  createdAt: string;
  sizeBytes: number;
  backupType: 'database';
  validationStatus: BackupValidationStatus;
  validationDetails: string;
  localStorageStatus: 'available' | 'missing';
  cloudSynchronizationStatus: CloudSynchronizationStatus;
  creationResult: BackupCreationResult;
}

export interface BackupStatusSummary {
  localStorageConfigured: boolean;
  localStorageDirectoryExists: boolean;
  localStorageWritable: boolean;
  cloudSyncConfigured: boolean;
  localSyncFolderDetected: boolean;
  latestBackupCopiedToSyncFolder: boolean;
  cloudSyncVerified: false;
  cloudSyncStatus: CloudSynchronizationStatus;
  latestBackupDate: string | null;
  latestBackupFile: string | null;
}

interface BackupManifest {
  version: 1;
  backups: BackupRecord[];
}

interface ScriptResult {
  stdout: string;
  stderr: string;
}

interface BackupServiceDependencies {
  backupRoot?: () => string;
  runScript?: (destinationDirectory: string, temporaryDatabasePath: string) => Promise<ScriptResult>;
  writeManifest?: (root: string, backups: BackupRecord[]) => Promise<void>;
  hashFile?: (handle: FileHandle) => Promise<string>;
  projectRoot?: string;
  logError?: (message: string, error: unknown) => void;
}

export class BackupConflictError extends Error {
  constructor() {
    super('Another database backup is already in progress.');
    this.name = 'BackupConflictError';
  }
}

export class InvalidBackupIdentifierError extends Error {
  constructor() {
    super('Invalid backup identifier.');
    this.name = 'InvalidBackupIdentifierError';
  }
}

export class BackupNotFoundError extends Error {
  constructor() {
    super('Backup not found.');
    this.name = 'BackupNotFoundError';
  }
}

export class BackupIntegrityError extends Error {
  constructor() {
    super('Backup integrity could not be verified.');
    this.name = 'BackupIntegrityError';
  }
}

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
};

const isInsideDirectory = (directory: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(directory), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

const configuredBackupRoot = (root: string): string => {
  const configured = process.env.SKILLSYNC_BACKUP_DIRECTORY?.trim();
  if (!configured) {
    return path.resolve(root, '..', 'SkillSync-backups', 'database');
  }
  if (!path.isAbsolute(configured) || configured.split(/[\\/]+/).includes('..')) {
    throw new Error('Configured backup directory must be an absolute path without traversal segments.');
  }
  return path.resolve(configured);
};

const validateBackupRoot = (candidate: string, repositoryRoot: string): string => {
  const resolved = path.resolve(candidate);
  if (isInsideDirectory(repositoryRoot, resolved) || resolved === path.parse(resolved).root) {
    throw new Error('Backup directory must be outside the project directory and cannot be a filesystem root.');
  }
  return resolved;
};

const assertNoSymlinkComponents = async (targetPath: string): Promise<void> => {
  const resolved = path.resolve(targetPath);
  const root = path.parse(resolved).root;
  const components = resolved.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  for (const component of components) {
    current = path.join(current, component);
    try {
      const stats = await fs.lstat(current);
      if (stats.isSymbolicLink()) throw new Error('Configured backup path contains a symbolic link or junction.');
      if (current !== resolved && !stats.isDirectory()) {
        throw new Error('Configured backup path contains a non-directory component.');
      }
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') return;
      throw error;
    }
  }
};

const getSyncDirectory = async (): Promise<{ configured: boolean; path: string | null; exists: boolean }> => {
  const configuredPath = process.env.SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY?.trim();
  const detectedPath = configuredPath
    || process.env.OneDrive?.trim()
    || process.env.OneDriveCommercial?.trim()
    || path.join(os.homedir(), 'OneDrive');
  const configured = Boolean(configuredPath);
  if (!path.isAbsolute(detectedPath)) {
    return { configured, path: null, exists: false };
  }
  try {
    const stats = await fs.stat(detectedPath);
    return { configured, path: stats.isDirectory() ? path.resolve(detectedPath) : null, exists: stats.isDirectory() };
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { configured, path: path.resolve(detectedPath), exists: false };
    }
    throw error;
  }
};

const sameFile = (
  left: Awaited<ReturnType<FileHandle['stat']>>,
  right: Awaited<ReturnType<FileHandle['stat']>>,
): boolean => left.dev === right.dev && left.ino === right.ino;

const openRegularFile = async (
  filePath: string,
): Promise<{ handle: FileHandle; stats: Awaited<ReturnType<FileHandle['stat']>> }> => {
  let handle: FileHandle | null = null;
  try {
    const before = await fs.lstat(filePath);
    if (!before.isFile() || before.isSymbolicLink()) throw new BackupNotFoundError();

    const noFollow = typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0;
    handle = await fs.open(filePath, fsConstants.O_RDONLY | noFollow);
    const opened = await handle.stat();
    const after = await fs.lstat(filePath);
    if (
      !opened.isFile()
      || !after.isFile()
      || after.isSymbolicLink()
      || !sameFile(before, opened)
      || !sameFile(opened, after)
    ) {
      throw new BackupNotFoundError();
    }
    return { handle, stats: opened };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    throw error;
  }
};

const getFileSha256 = async (handle: FileHandle): Promise<string> => {
  const before = await handle.stat();
  const hash = createHash('sha256');
  const stream = handle.createReadStream({ autoClose: false, start: 0 });
  let bytesRead = 0;
  for await (const chunk of stream) {
    hash.update(chunk);
    bytesRead += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
  }
  const after = await handle.stat();
  if (!sameFile(before, after) || before.size !== after.size || bytesRead !== before.size) {
    throw new Error('Backup file changed while its contents were being verified.');
  }
  return hash.digest('hex');
};

const getCloudStatus = async (
  filename: string | null,
  syncDirectory: Awaited<ReturnType<typeof getSyncDirectory>>,
  sourceHash: string | null,
  hashFile: (handle: FileHandle) => Promise<string>,
): Promise<CloudSynchronizationStatus> => {
  if (!syncDirectory.configured && !syncDirectory.exists) return 'not_configured';
  if (syncDirectory.configured && !syncDirectory.exists) return 'configured_but_unavailable';
  if (!syncDirectory.exists || !syncDirectory.path) return 'local_sync_folder_detected';
  if (filename) {
    try {
      const target = path.join(syncDirectory.path, filename);
      if (sourceHash) {
        const { handle } = await openRegularFile(target);
        try {
          const copyHash = await hashFile(handle);
          if (sourceHash === copyHash) return 'backup_copied_to_sync_folder';
        } finally {
          await handle.close();
        }
      }
    } catch (error) {
      const code = errorCode(error);
      if (!(error instanceof BackupNotFoundError) && code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
  }
  return 'local_sync_folder_detected';
};

const validValidationStatus = (value: unknown): value is BackupValidationStatus =>
  value === 'passed' || value === 'failed' || value === 'unknown';

const validCreationResult = (value: unknown): value is BackupCreationResult =>
  value === 'running' || value === 'succeeded' || value === 'failed' || value === 'unknown';

const validCloudStatus = (value: unknown): value is CloudSynchronizationStatus =>
  value === 'not_configured'
  || value === 'configured_but_unavailable'
  || value === 'local_sync_folder_detected'
  || value === 'backup_copied_to_sync_folder'
  || value === 'not_independently_verified';

const isBackupRecord = (value: unknown): value is BackupRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<BackupRecord>;
  return typeof record.id === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(record.id)
    && !record.id.includes('..')
    && (record.filename === null || (typeof record.filename === 'string' && backupFilenamePattern.test(record.filename)))
    && typeof record.createdAt === 'string'
    && Number.isFinite(Date.parse(record.createdAt))
    && typeof record.sizeBytes === 'number'
    && Number.isFinite(record.sizeBytes)
    && record.sizeBytes >= 0
    && record.backupType === 'database'
    && (
      record.sha256 === undefined
      || record.sha256 === null
      || (typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(record.sha256))
    )
    && validValidationStatus(record.validationStatus)
    && typeof record.validationDetails === 'string'
    && safeValidationDetails.has(record.validationDetails)
    && (record.localStorageStatus === 'available' || record.localStorageStatus === 'missing')
    && validCloudStatus(record.cloudSynchronizationStatus)
    && validCreationResult(record.creationResult);
};

const unknownFileRecord = async (
  filename: string,
  filePath: string,
  cloudStatus: CloudSynchronizationStatus,
): Promise<BackupRecord> => {
  const stats = await fs.stat(filePath);
  return {
    id: filename,
    filename,
    sha256: null,
    createdAt: stats.mtime.toISOString(),
    sizeBytes: stats.size,
    backupType: 'database',
    validationStatus: 'unknown',
    validationDetails: 'No confirmed validation metadata is available for this backup.',
    localStorageStatus: 'available',
    cloudSynchronizationStatus: cloudStatus,
    creationResult: 'unknown',
  };
};

const readManifest = async (
  root: string,
  logError: (message: string, error: unknown) => void,
): Promise<BackupRecord[]> => {
  const manifestPath = path.join(root, manifestName);
  try {
    const stats = await fs.lstat(manifestPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error('Backup manifest is not a regular file.');
    }
    const contents = await fs.readFile(manifestPath, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    if (
      !parsed
      || typeof parsed !== 'object'
      || (parsed as Partial<BackupManifest>).version !== 1
      || !Array.isArray((parsed as Partial<BackupManifest>).backups)
    ) {
      throw new Error('Backup manifest has an unsupported structure.');
    }
    return (parsed as BackupManifest).backups.filter(isBackupRecord);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return [];
    logError('Backup manifest could not be read; unverified files will still be listed.', error);
    return [];
  }
};

const writeManifest = async (root: string, backups: BackupRecord[]): Promise<void> => {
  const manifestPath = path.join(root, manifestName);
  const temporaryPath = path.join(root, `.${manifestName}.${randomUUID()}.tmp`);
  const handle = await fs.open(temporaryPath, 'wx', 0o600);
  let closed = false;
  try {
    await handle.writeFile(`${JSON.stringify({ version: 1, backups } satisfies BackupManifest, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    closed = true;
    await fs.rename(temporaryPath, manifestPath);
  } finally {
    if (!closed) await handle.close().catch((error) => console.error('[admin-backup] Could not close temporary manifest.', error));
    await fs.rm(temporaryPath, { force: true }).catch((error) => {
      if (errorCode(error) !== 'ENOENT') console.error('[admin-backup] Could not remove temporary manifest.', error);
    });
  }
};

const defaultRunScript = async (
  destinationDirectory: string,
  temporaryDatabasePath: string,
): Promise<ScriptResult> => {
  const windowsSystemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershellExecutable = path.join(windowsSystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const scriptPath = path.resolve(projectRoot, 'scripts', 'backup-database.ps1');
  return new Promise((resolve, reject) => {
    execFile(
      powershellExecutable,
      [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
        '-DestinationDirectory', destinationDirectory,
        '-TemporaryDatabasePath', temporaryDatabasePath,
      ],
      { windowsHide: true, timeout: processTimeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          Object.assign(error, { stdout, stderr });
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
};

const extractReportedBackupPath = (output: string): string | null => {
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith('Database backup created:'));
  if (!line) return null;
  return line.slice('Database backup created:'.length).trim() || null;
};

const createTemporaryBackupPath = (root: string): string => {
  const date = new Date();
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
  const timestamp = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}-${pad(date.getUTCMilliseconds(), 3)}`;
  return path.join(root, `.skillsync-database-${timestamp}-${randomUUID().replace(/-/g, '')}.tmp`);
};

const cleanupOwnedTemporaryFile = async (
  root: string,
  temporaryPath: string | null,
  logError: (message: string, error: unknown) => void,
): Promise<void> => {
  try {
    if (!temporaryPath) return;
    if (
      !isInsideDirectory(root, temporaryPath)
      || !/^\.skillsync-database-\d{8}-\d{6}-\d{3}-[0-9a-f]{32}\.tmp$/i.test(path.basename(temporaryPath))
    ) return;
    const stats = await fs.lstat(temporaryPath);
    if (!stats.isFile() || stats.isSymbolicLink()) return;
    await fs.rm(temporaryPath);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') logError('Could not remove this operation temporary backup file.', error);
  }
};

export const createBackupService = (dependencies: BackupServiceDependencies = {}) => {
  const repositoryRoot = path.resolve(dependencies.projectRoot ?? projectRoot);
  const getConfiguredRoot = (): string => {
    const configuredRoot = dependencies.backupRoot?.()
      ?? configuredBackupRoot(repositoryRoot);
    return validateBackupRoot(configuredRoot, repositoryRoot);
  };
  const logError = dependencies.logError ?? ((message: string, error: unknown) => {
    console.error(`[admin-backup] ${message}`, error);
  });
  const runScript = dependencies.runScript ?? defaultRunScript;
  const persistManifest = dependencies.writeManifest ?? writeManifest;
  const hashFile = dependencies.hashFile ?? getFileSha256;
  let backupInProgress = false;

  const listBackupHistory = async (): Promise<BackupRecord[]> => {
    const root = getConfiguredRoot();
    await assertNoSymlinkComponents(root);
    if (!(await pathExists(root))) return [];

    const [manifestRecords, entries, syncDirectory] = await Promise.all([
      readManifest(root, logError),
      fs.readdir(root, { withFileTypes: true }),
      getSyncDirectory(),
    ]);
    const recordsByFilename = new Map(
      manifestRecords.filter((record) => record.filename).map((record) => [record.filename as string, record]),
    );
    const results: BackupRecord[] = [];
    const seenFilenames = new Set<string>();

    for (const entry of entries) {
      if (!entry.isFile() || !backupFilenamePattern.test(entry.name)) continue;
      const filePath = path.join(root, entry.name);
      const stats = await fs.lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) continue;
      seenFilenames.add(entry.name);
      const stored = recordsByFilename.get(entry.name);
      let actualHash: string | null = null;
      try {
        const opened = await openRegularFile(filePath);
        try {
          if (opened.stats.size !== stats.size) throw new Error('Backup file changed during history inspection.');
          actualHash = await hashFile(opened.handle);
        } finally {
          await opened.handle.close();
        }
      } catch (error) {
        logError('Backup file SHA-256 could not be verified.', error);
      }
      const cloudStatus = await getCloudStatus(entry.name, syncDirectory, actualHash, hashFile);

      if (!stored) {
        const unknown = await unknownFileRecord(entry.name, filePath, cloudStatus);
        if (!actualHash) unknown.validationDetails = 'Backup SHA-256 could not be verified; validation is not verified.';
        results.push(unknown);
        continue;
      }

      const current: BackupRecord = {
        ...stored,
        localStorageStatus: 'available',
        cloudSynchronizationStatus: cloudStatus,
      };
      if (!stored.sha256) {
        current.validationStatus = 'unknown';
        current.validationDetails = 'No SHA-256 metadata is available; backup integrity is not verified.';
      } else if (!actualHash) {
        current.validationStatus = 'unknown';
        current.validationDetails = 'Backup SHA-256 could not be verified; validation is not verified.';
      } else if (stored.sha256.toLowerCase() !== actualHash) {
        current.validationStatus = 'failed';
        current.validationDetails = 'Backup SHA-256 does not match stored metadata; validation failed.';
      } else if (stored.sizeBytes !== stats.size) {
        current.validationStatus = 'failed';
        current.validationDetails = 'Backup file size does not match stored metadata; validation failed.';
      } else if (stored.creationResult === 'failed' && current.validationStatus === 'passed') {
        current.validationStatus = 'failed';
        current.validationDetails = 'Backup metadata could not be saved; validation is not considered successful.';
      }
      results.push(current);
    }

    for (const record of manifestRecords) {
      if (record.filename && seenFilenames.has(record.filename)) continue;
      if (record.filename) {
        results.push({
          ...record,
          localStorageStatus: 'missing',
          validationStatus: record.validationStatus === 'passed' ? 'failed' : record.validationStatus,
          validationDetails: 'Backup file is missing; validation is not verified.',
        });
      } else {
        results.push(record);
      }
    }

    return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  };

  const getBackupStatusSummary = async (history?: BackupRecord[]): Promise<BackupStatusSummary> => {
    const root = getConfiguredRoot();
    await assertNoSymlinkComponents(root);
    const localStorageDirectoryExists = await pathExists(root);
    let localStorageWritable = false;
    if (localStorageDirectoryExists) {
      try {
        await fs.access(root, fs.constants.W_OK);
        localStorageWritable = true;
      } catch (error) {
        const code = errorCode(error);
        if (code !== 'EACCES' && code !== 'EPERM') throw error;
      }
    }

    const [syncDirectory, backups] = await Promise.all([
      getSyncDirectory(),
      history ? Promise.resolve(history) : listBackupHistory(),
    ]);
    const latestBackup = backups.find((backup) => backup.filename && backup.localStorageStatus === 'available');
    const latestBackupCopiedToSyncFolder =
      latestBackup?.cloudSynchronizationStatus === 'backup_copied_to_sync_folder';
    let cloudSyncStatus: CloudSynchronizationStatus;
    if (!syncDirectory.configured && !syncDirectory.exists) {
      cloudSyncStatus = 'not_configured';
    } else if (syncDirectory.configured && !syncDirectory.exists) {
      cloudSyncStatus = 'configured_but_unavailable';
    } else if (latestBackupCopiedToSyncFolder) {
      cloudSyncStatus = 'backup_copied_to_sync_folder';
    } else if (syncDirectory.exists) {
      cloudSyncStatus = 'local_sync_folder_detected';
    } else {
      cloudSyncStatus = 'not_independently_verified';
    }

    return {
      localStorageConfigured: true,
      localStorageDirectoryExists,
      localStorageWritable,
      cloudSyncConfigured: syncDirectory.configured,
      localSyncFolderDetected: syncDirectory.exists,
      latestBackupCopiedToSyncFolder,
      cloudSyncVerified: false,
      cloudSyncStatus,
      latestBackupDate: latestBackup?.createdAt ?? null,
      latestBackupFile: latestBackup?.filename ?? null,
    };
  };

  const createDatabaseBackup = async (): Promise<{ backup: BackupRecord; message: string }> => {
    if (backupInProgress) throw new BackupConflictError();

    const destinationRoot = getConfiguredRoot();
    await fs.mkdir(destinationRoot, { recursive: true });
    await assertNoSymlinkComponents(destinationRoot);
    const lockPath = path.join(destinationRoot, '.skillsync-database-backup.lock');
    let lockHandle: Awaited<ReturnType<typeof fs.open>>;
    try {
      lockHandle = await fs.open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (errorCode(error) === 'EEXIST') throw new BackupConflictError();
      throw error;
    }

    backupInProgress = true;
    const startedAt = new Date();
    const backupId = randomUUID();
    const temporaryDatabasePath = createTemporaryBackupPath(destinationRoot);
    const record: BackupRecord = {
      id: backupId,
      filename: null,
      sha256: null,
      createdAt: startedAt.toISOString(),
      sizeBytes: 0,
      backupType: 'database',
      validationStatus: 'unknown',
      validationDetails: 'Backup operation is in progress.',
      localStorageStatus: 'missing',
      cloudSynchronizationStatus: 'not_configured',
      creationResult: 'running',
    };
    let records: BackupRecord[] = [];
    let ownsTemporaryFile = false;

    try {
      records = await readManifest(destinationRoot, logError);
      records.push(record);
      await persistManifest(destinationRoot, records);

      const temporaryHandle = await fs.open(temporaryDatabasePath, 'wx', 0o600);
      ownsTemporaryFile = true;
      await temporaryHandle.close();

      let output: string;
      try {
        const result = await runScript(destinationRoot, temporaryDatabasePath);
        output = `${result.stdout}\n${result.stderr}`;
      } catch (error) {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The backup process failed; validation was not accepted.';
        record.localStorageStatus = 'missing';
        logError('Database backup process failed.', error);
        throw new Error('Database backup process failed.');
      }

      const reportedPath = extractReportedBackupPath(output);
      const validationConfirmed = output.split(/\r?\n/).some((line) => line.trim() === validationOutput);
      if (!reportedPath || !path.isAbsolute(reportedPath)) {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The backup process did not report a recognized backup file.';
        throw new Error('Backup process did not report a recognized backup file.');
      }

      const filename = path.basename(reportedPath);
      const backupPath = path.resolve(reportedPath);
      if (
        !backupFilenamePattern.test(filename)
        || !isInsideDirectory(destinationRoot, backupPath)
      ) {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The reported backup file was outside the configured backup directory.';
        throw new Error('Backup process reported a file outside the configured backup directory.');
      }
      let backupStats: Awaited<ReturnType<typeof fs.lstat>>;
      try {
        backupStats = await fs.lstat(backupPath);
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The backup file was not created.';
        throw new Error('Backup process completed without creating the reported file.');
      }
      if (!backupStats.isFile() || backupStats.isSymbolicLink()) {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The reported backup is not a regular file.';
        throw new Error('Reported backup is not a regular file.');
      }

      const { handle, stats: verifiedStats } = await openRegularFile(backupPath);
      let sha256: string;
      try {
        if (verifiedStats.size !== backupStats.size) throw new Error('Backup file changed during validation.');
        sha256 = await hashFile(handle);
      } finally {
        await handle.close();
      }

      const syncDirectory = await getSyncDirectory();
      record.filename = filename;
      record.sizeBytes = verifiedStats.size;
      record.sha256 = sha256;
      record.creationResult = 'succeeded';
      record.validationStatus = validationConfirmed ? 'passed' : 'unknown';
      record.validationDetails = validationConfirmed
        ? 'SQLite integrity, Prisma schema, checked-in migrations, and foreign-key validation passed.'
        : 'Validation output was missing or unrecognized; validation was not confirmed.';
      record.localStorageStatus = 'available';
      record.cloudSynchronizationStatus = await getCloudStatus(filename, syncDirectory, sha256, hashFile);
      record.createdAt = backupStats.mtime.toISOString();
      records[records.length - 1] = record;
      try {
        await persistManifest(destinationRoot, records);
      } catch (error) {
        logError('Could not persist completed database backup metadata.', error);
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'Backup metadata could not be saved; validation is not considered successful.';
        throw new Error('Backup metadata could not be saved.');
      }
      return {
        backup: { ...record },
        message: validationConfirmed
          ? 'Database backup created and validated successfully.'
          : 'Database backup created, but validation could not be confirmed.',
      };
    } catch (error) {
      if (record.creationResult === 'running') {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The backup operation failed before validation completed.';
      } else if (record.creationResult === 'succeeded') {
        record.creationResult = 'failed';
        record.validationStatus = 'failed';
        record.validationDetails = 'The backup process completed, but its final metadata could not be saved.';
      }
      const currentRecords = await readManifest(destinationRoot, logError);
      const existingIndex = currentRecords.findIndex((entry) => entry.id === record.id);
      if (existingIndex >= 0) currentRecords[existingIndex] = record;
      else currentRecords.push(record);
      try {
        await persistManifest(destinationRoot, currentRecords);
      } catch (manifestError) {
        logError('Could not persist the failed backup result to the manifest.', manifestError);
      }
      throw error;
    } finally {
      await cleanupOwnedTemporaryFile(
        destinationRoot,
        ownsTemporaryFile ? temporaryDatabasePath : null,
        logError,
      );
      backupInProgress = false;
      await lockHandle.close().catch((error) => logError('Could not close the backup lock file.', error));
      await fs.rm(lockPath, { force: true }).catch((error) => logError('Could not remove the backup lock file.', error));
    }
  };

  const openVerifiedBackup = async (
    identifier: string,
  ): Promise<{ handle: FileHandle; filename: string; sizeBytes: number }> => {
    if (
      typeof identifier !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(identifier)
      || identifier.includes('..')
      || path.isAbsolute(identifier)
    ) {
      throw new InvalidBackupIdentifierError();
    }

    const root = getConfiguredRoot();
    await assertNoSymlinkComponents(root);
    const records = await readManifest(root, logError);
    const backup = records.find((record) => record.id === identifier);
    const filename = backup?.filename ?? (backupFilenamePattern.test(identifier) ? identifier : null);
    if (!filename) {
      throw new BackupNotFoundError();
    }
    if (!backupFilenamePattern.test(filename) || !backup?.sha256) throw new BackupIntegrityError();
    const resolved = path.resolve(root, filename);
    if (!isInsideDirectory(root, resolved)) throw new InvalidBackupIdentifierError();

    let handle: FileHandle | null = null;
    try {
      const opened = await openRegularFile(resolved);
      handle = opened.handle;
      if (opened.stats.size !== backup.sizeBytes) {
        await handle.close();
        handle = null;
        throw new BackupIntegrityError();
      }
      const actualHash = await hashFile(handle);
      if (actualHash !== backup.sha256.toLowerCase()) {
        await handle.close();
        handle = null;
        throw new BackupIntegrityError();
      }
      const verified = { handle, filename, sizeBytes: opened.stats.size };
      handle = null;
      return verified;
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') {
        throw new BackupNotFoundError();
      }
      if (error instanceof BackupNotFoundError || error instanceof InvalidBackupIdentifierError || error instanceof BackupIntegrityError) {
        throw error;
      }
      logError('Backup file could not be verified before download.', error);
      throw new BackupIntegrityError();
    }
  };

  return {
    getBackupRoot: async () => getConfiguredRoot(),
    listBackupHistory,
    getBackupStatusSummary,
    createDatabaseBackup,
    openVerifiedBackup,
  };
};

const backupService = createBackupService();

export const getBackupRoot = backupService.getBackupRoot;
export const listBackupHistory = backupService.listBackupHistory;
export const getBackupStatusSummary = backupService.getBackupStatusSummary;
export const createDatabaseBackup = backupService.createDatabaseBackup;
export const openVerifiedBackup = backupService.openVerifiedBackup;
