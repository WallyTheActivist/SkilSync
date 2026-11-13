const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const {
  BackupConflictError,
  BackupIntegrityError,
  BackupNotFoundError,
  InvalidBackupIdentifierError,
  createBackupService,
} = require('../dist/services/backupService');

const validationLine =
  'Validation: SQLite integrity passed; expected Prisma tables and all checked-in migrations present; foreign keys valid.';
const backupFilename = 'skillsync-database-20261108-153049-050.sqlite';
const roots = [];
const savedEnvironment = new Map();
const environmentKeys = ['SKILLSYNC_BACKUP_DIRECTORY', 'SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY', 'OneDrive', 'OneDriveCommercial'];

const saveEnvironment = () => {
  for (const key of environmentKeys) {
    if (!savedEnvironment.has(key)) savedEnvironment.set(key, process.env[key]);
  }
  for (const key of environmentKeys) delete process.env[key];
};

const createRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillsync-backup-test-'));
  roots.push(root);
  return root;
};

const createFile = async (directory, filename = backupFilename, contents = 'synthetic database bytes') => {
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, filename);
  await fs.writeFile(target, contents);
  return target;
};

const scriptOutput = (directory, includeValidation = true) => ({
  stdout: [
    `Database backup created: ${path.join(directory, backupFilename)}`,
    ...(includeValidation ? [validationLine] : []),
  ].join('\n'),
  stderr: '',
});

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');

const writeManifestBackup = async (root, contents = 'synthetic database bytes', overrides = {}) => {
  const filePath = await createFile(root, backupFilename, contents);
  const record = {
    id: 'manifest-backup-id',
    filename: backupFilename,
    sha256: sha256(contents),
    createdAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(contents),
    backupType: 'database',
    validationStatus: 'passed',
    validationDetails: 'SQLite integrity, Prisma schema, checked-in migrations, and foreign-key validation passed.',
    localStorageStatus: 'available',
    cloudSynchronizationStatus: 'not_configured',
    creationResult: 'succeeded',
    ...overrides,
  };
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, backups: [record] }));
  return { filePath, record };
};

afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
  for (const key of environmentKeys) {
    const saved = savedEnvironment.get(key);
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
});

test('successful process with explicit validation persists durable metadata without file paths', async () => {
  saveEnvironment();
  const root = await createRoot();
  const service = createBackupService({
    backupRoot: () => root,
    projectRoot: path.resolve(__dirname, '..', '..'),
    runScript: async (destination) => {
      await createFile(destination);
      return scriptOutput(destination);
    },
  });

  const result = await service.createDatabaseBackup();
  assert.equal(result.backup.validationStatus, 'passed');
  assert.equal(result.backup.creationResult, 'succeeded');
  assert.equal(result.backup.validationDetails.includes('foreign-key'), true);
  assert.equal(result.backup.filename, backupFilename);
  assert.equal(result.backup.sizeBytes, Buffer.byteLength('synthetic database bytes'));
  assert.equal(result.backup.sha256, sha256('synthetic database bytes'));
  assert.equal(Object.hasOwn(result.backup, 'path'), false);

  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.backups[0].id, result.backup.id);
  assert.equal(manifest.backups[0].sha256, result.backup.sha256);
  assert.equal(JSON.stringify(manifest).includes(root), false);

  const restartedService = createBackupService({ backupRoot: () => root });
  const history = await restartedService.listBackupHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].validationStatus, 'passed');
  assert.equal(history[0].id, result.backup.id);
  assert.equal(Object.hasOwn(history[0], 'path'), false);
});

test('successful process without recognized validation output is retained as unverified', async () => {
  saveEnvironment();
  const root = await createRoot();
  const service = createBackupService({
    backupRoot: () => root,
    runScript: async (destination) => {
      await createFile(destination);
      return scriptOutput(destination, false);
    },
  });

  const { backup } = await service.createDatabaseBackup();
  assert.equal(backup.creationResult, 'succeeded');
  assert.equal(backup.validationStatus, 'unknown');
  assert.match(backup.validationDetails, /not confirmed/i);
});

test('failed PowerShell process records failure and rejects creation', async () => {
  saveEnvironment();
  const root = await createRoot();
  const logged = [];
  const service = createBackupService({
    backupRoot: () => root,
    logError: (...args) => logged.push(args),
    runScript: async () => {
      const error = new Error('PowerShell exit code 1');
      error.code = 1;
      error.stdout = '';
      error.stderr = 'Synthetic script failure';
      throw error;
    },
  });

  await assert.rejects(service.createDatabaseBackup(), /process failed/i);
  const [record] = await service.listBackupHistory();
  assert.equal(record.creationResult, 'failed');
  assert.equal(record.validationStatus, 'failed');
  assert.equal(logged.length, 1);
});

test('PowerShell process timeouts are recorded as failures', async () => {
  saveEnvironment();
  const root = await createRoot();
  let temporaryPath;
  const service = createBackupService({
    backupRoot: () => root,
    logError: () => {},
    runScript: async (_destination, ownedTemporaryPath) => {
      temporaryPath = ownedTemporaryPath;
      await fs.writeFile(temporaryPath, 'partial output from timed-out operation');
      const error = new Error('Synthetic process timeout');
      error.code = 'ETIMEDOUT';
      error.killed = true;
      throw error;
    },
  });

  await assert.rejects(service.createDatabaseBackup(), /process failed/i);
  const [record] = await service.listBackupHistory();
  assert.equal(record.creationResult, 'failed');
  assert.equal(record.validationStatus, 'failed');
  await assert.rejects(fs.access(temporaryPath), { code: 'ENOENT' });
});

test('successful process with a missing backup file records failure', async () => {
  saveEnvironment();
  const root = await createRoot();
  const service = createBackupService({
    backupRoot: () => root,
    runScript: async (destination) => scriptOutput(destination),
  });

  await assert.rejects(service.createDatabaseBackup(), /without creating/i);
  const [record] = await service.listBackupHistory();
  assert.equal(record.creationResult, 'failed');
  assert.equal(record.validationStatus, 'failed');
  assert.equal(record.filename, null);
});

test('missing and malformed manifests leave existing backups unverified', async () => {
  saveEnvironment();
  const root = await createRoot();
  await createFile(root);
  const service = createBackupService({
    backupRoot: () => root,
    logError: () => {},
  });

  let [record] = await service.listBackupHistory();
  assert.equal(record.validationStatus, 'unknown');
  assert.equal(record.creationResult, 'unknown');

  await fs.writeFile(path.join(root, 'manifest.json'), '{"version": 1, "backups": [');
  [record] = await service.listBackupHistory();
  assert.equal(record.validationStatus, 'unknown');
  assert.equal(record.creationResult, 'unknown');

  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
    version: 1,
    backups: [{ id: 'partial-record', filename: backupFilename, validationStatus: 'passed' }],
  }));
  [record] = await service.listBackupHistory();
  assert.equal(record.validationStatus, 'unknown');
  assert.equal(record.creationResult, 'unknown');

  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
    version: 1,
    backups: [{
      id: root,
      filename: backupFilename,
      createdAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength('synthetic database bytes'),
      backupType: 'database',
      validationStatus: 'passed',
      validationDetails: `Error at ${root}`,
      localStorageStatus: 'available',
      cloudSynchronizationStatus: 'not_configured',
      creationResult: 'succeeded',
    }],
  }));
  const recoveredHistory = await service.listBackupHistory();
  assert.equal(recoveredHistory[0].validationStatus, 'unknown');
  assert.equal(JSON.stringify(recoveredHistory).includes(root), false);
});

test('configured backup directory inside the project is rejected', async () => {
  saveEnvironment();
  const projectRoot = path.resolve(__dirname, '..', '..');
  const service = createBackupService({
    projectRoot,
    backupRoot: () => path.join(projectRoot, 'unsafe-backups'),
  });

  await assert.rejects(service.getBackupRoot(), /outside the project directory/i);
});

test('configured paths containing traversal are rejected', async () => {
  saveEnvironment();
  process.env.SKILLSYNC_BACKUP_DIRECTORY = `${path.resolve(__dirname, '..', '..')}\\..\\outside`;
  const service = createBackupService();
  await assert.rejects(service.getBackupRoot(), /absolute path without traversal/i);
});

test('simultaneous backup requests conflict and only one process starts', async () => {
  saveEnvironment();
  const root = await createRoot();
  let releaseProcess;
  let processStarted;
  const started = new Promise((resolve) => { processStarted = resolve; });
  const service = createBackupService({
    backupRoot: () => root,
    runScript: async (destination) => {
      processStarted();
      await new Promise((resolve) => { releaseProcess = resolve; });
      await createFile(destination);
      return scriptOutput(destination);
    },
  });
  const otherServiceInstance = createBackupService({ backupRoot: () => root });

  const firstBackup = service.createDatabaseBackup();
  await started;
  await assert.rejects(otherServiceInstance.createDatabaseBackup(), BackupConflictError);
  releaseProcess();
  const result = await firstBackup;
  assert.equal(result.backup.validationStatus, 'passed');
  assert.equal((await service.listBackupHistory()).filter((item) => item.creationResult === 'succeeded').length, 1);
});

test('OneDrive status distinguishes unconfigured, detected, and local-copy states without cloud verification', async () => {
  saveEnvironment();
  const root = await createRoot();
  const absentFolder = path.join(root, 'not-present');
  process.env.OneDrive = absentFolder;
  const service = createBackupService({ backupRoot: () => root });

  let status = await service.getBackupStatusSummary();
  assert.equal(status.cloudSyncConfigured, false);
  assert.equal(status.localSyncFolderDetected, false);
  assert.equal(status.cloudSyncStatus, 'not_configured');
  assert.equal(status.cloudSyncVerified, false);

  const syncFolder = path.join(root, 'OneDrive');
  await fs.mkdir(syncFolder);
  process.env.OneDrive = syncFolder;
  status = await service.getBackupStatusSummary();
  assert.equal(status.cloudSyncConfigured, false);
  assert.equal(status.localSyncFolderDetected, true);
  assert.equal(status.cloudSyncStatus, 'local_sync_folder_detected');
  assert.equal(status.cloudSyncVerified, false);

  const backupPath = await createFile(root);
  await fs.copyFile(backupPath, path.join(syncFolder, backupFilename));
  status = await service.getBackupStatusSummary();
  assert.equal(status.latestBackupCopiedToSyncFolder, true);
  assert.equal(status.cloudSyncStatus, 'backup_copied_to_sync_folder');
  assert.equal(status.cloudSyncVerified, false);
  assert.equal(Object.hasOwn(status, 'syncDestinationPath'), false);

  process.env.SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY = path.join(root, 'configured-but-missing');
  status = await service.getBackupStatusSummary();
  assert.equal(status.cloudSyncConfigured, true);
  assert.equal(status.localSyncFolderDetected, false);
  assert.equal(status.cloudSyncStatus, 'configured_but_unavailable');
  assert.equal(status.cloudSyncVerified, false);
});

test('local OneDrive copy requires matching source and copy SHA-256 digests', async () => {
  saveEnvironment();
  const root = await createRoot();
  const syncFolder = path.join(root, 'sync');
  await fs.mkdir(syncFolder);
  process.env.SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY = syncFolder;
  const service = createBackupService({ backupRoot: () => root });
  const backupPath = await createFile(root, backupFilename, 'same length bytes');
  const copiedPath = path.join(syncFolder, backupFilename);
  await fs.copyFile(backupPath, copiedPath);

  let [backup] = await service.listBackupHistory();
  let status = await service.getBackupStatusSummary();
  assert.equal(backup.cloudSynchronizationStatus, 'backup_copied_to_sync_folder');
  assert.equal(status.latestBackupCopiedToSyncFolder, true);
  assert.equal(status.cloudSyncVerified, false);

  await fs.writeFile(copiedPath, 'different content');
  assert.equal((await fs.stat(copiedPath)).size, (await fs.stat(backupPath)).size);

  [backup] = await service.listBackupHistory();
  status = await service.getBackupStatusSummary();
  assert.equal(backup.cloudSynchronizationStatus, 'local_sync_folder_detected');
  assert.equal(status.latestBackupCopiedToSyncFolder, false);
  assert.equal(status.cloudSyncVerified, false);
});

test('one history/status inspection hashes each source and sync copy once', async () => {
  saveEnvironment();
  const root = await createRoot();
  const syncFolder = path.join(root, 'sync');
  await fs.mkdir(syncFolder);
  const contents = 'hash once per inspected file';
  await writeManifestBackup(root, contents);
  await fs.copyFile(path.join(root, backupFilename), path.join(syncFolder, backupFilename));
  process.env.SKILLSYNC_ONEDRIVE_SYNC_DIRECTORY = syncFolder;
  let hashCalls = 0;
  const service = createBackupService({
    backupRoot: () => root,
    hashFile: async (handle) => {
      hashCalls += 1;
      const hash = createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
      return hash.digest('hex');
    },
  });

  const history = await service.listBackupHistory();
  assert.equal(hashCalls, 2);
  const status = await service.getBackupStatusSummary(history);
  assert.equal(status.latestBackupCopiedToSyncFolder, true);
  assert.equal(hashCalls, 2);
});

test('a matching manifest SHA-256 retains passed validation and opens the verified backup', async () => {
  saveEnvironment();
  const root = await createRoot();
  const { record } = await writeManifestBackup(root);
  const service = createBackupService({ backupRoot: () => root });

  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'passed');
  assert.equal(backup.sha256, record.sha256);
  const opened = await service.openVerifiedBackup(record.id);
  assert.equal(opened.filename, backupFilename);
  assert.equal(opened.sizeBytes, record.sizeBytes);
  await opened.handle.close();
  await assert.rejects(opened.handle.stat(), { code: 'EBADF' });
});

test('modified backup with a different SHA-256 is marked failed and is not downloadable', async () => {
  saveEnvironment();
  const root = await createRoot();
  const { filePath, record } = await writeManifestBackup(root);
  await fs.writeFile(filePath, 'X'.repeat(record.sizeBytes));
  const service = createBackupService({ backupRoot: () => root });

  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'failed');
  assert.match(backup.validationDetails, /SHA-256 does not match/i);
  await assert.rejects(service.openVerifiedBackup(record.id), BackupIntegrityError);
});

test('same-size modified backup with a different SHA-256 is marked failed', async () => {
  saveEnvironment();
  const root = await createRoot();
  const contents = 'same size database bytes';
  const { filePath, record } = await writeManifestBackup(root, contents);
  await fs.writeFile(filePath, 'X'.repeat(contents.length));
  assert.equal((await fs.stat(filePath)).size, Buffer.byteLength(contents));

  const service = createBackupService({ backupRoot: () => root });
  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'failed');
  assert.match(backup.validationDetails, /SHA-256 does not match/i);
  await assert.rejects(service.openVerifiedBackup(record.id), BackupIntegrityError);
});

test('missing backup file is not presented as passed and cannot be downloaded', async () => {
  saveEnvironment();
  const root = await createRoot();
  const { filePath, record } = await writeManifestBackup(root);
  await fs.unlink(filePath);
  const service = createBackupService({ backupRoot: () => root });

  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'failed');
  assert.equal(backup.localStorageStatus, 'missing');
  assert.match(backup.validationDetails, /file is missing/i);
  await assert.rejects(service.openVerifiedBackup(record.id), BackupNotFoundError);
});

test('legacy manifest records without SHA-256 remain unverified and cannot be downloaded', async () => {
  saveEnvironment();
  const root = await createRoot();
  const { record } = await writeManifestBackup(root);
  delete record.sha256;
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, backups: [record] }));
  const service = createBackupService({ backupRoot: () => root });

  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'unknown');
  assert.match(backup.validationDetails, /No SHA-256 metadata/i);
  await assert.rejects(service.openVerifiedBackup(record.id), BackupIntegrityError);
});

test('SHA-256 read failure leaves history unverified and closes the file handle', async () => {
  saveEnvironment();
  const root = await createRoot();
  const { record } = await writeManifestBackup(root);
  const logs = [];
  let downloadHandle;
  const service = createBackupService({
    backupRoot: () => root,
    hashFile: async (handle) => {
      downloadHandle = handle;
      await handle.stat();
      throw new Error('synthetic hash read failure');
    },
    logError: (...args) => logs.push(args),
  });

  const [backup] = await service.listBackupHistory();
  assert.equal(backup.validationStatus, 'unknown');
  assert.match(backup.validationDetails, /could not be verified/i);
  assert.equal(logs.length, 1);
  await assert.rejects(service.openVerifiedBackup(record.id), BackupIntegrityError);
  await assert.rejects(downloadHandle.stat(), { code: 'EBADF' });
});

test('download opening rejects a symbolic-link backup when the platform permits symlinks', async (t) => {
  saveEnvironment();
  const root = await createRoot();
  const { filePath, record } = await writeManifestBackup(root);
  const outsidePath = path.join(root, 'outside.sqlite');
  await fs.rename(filePath, outsidePath);
  try {
    await fs.symlink(outsidePath, filePath, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS'].includes(error.code)) {
      t.skip(`Symlink creation is not supported in this environment (${error.code}).`);
      return;
    }
    throw error;
  }
  const service = createBackupService({ backupRoot: () => root });
  await assert.rejects(service.openVerifiedBackup(record.id), BackupNotFoundError);
});

test('invalid and unavailable backup identifiers are rejected before opening', async () => {
  saveEnvironment();
  const root = await createRoot();
  const service = createBackupService({ backupRoot: () => root });
  await assert.rejects(service.openVerifiedBackup('..\\outside.sqlite'), InvalidBackupIdentifierError);
  await assert.rejects(service.openVerifiedBackup('missing.sqlite'), BackupNotFoundError);
});

test('manifest persistence failure after validation records failure rather than Passed', async () => {
  saveEnvironment();
  const root = await createRoot();
  let writeCount = 0;
  const service = createBackupService({
    backupRoot: () => root,
    runScript: async (destination) => {
      await createFile(destination);
      return scriptOutput(destination);
    },
    writeManifest: async (directory, records) => {
      writeCount += 1;
      if (writeCount === 2) throw new Error('synthetic manifest path failure');
      await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ version: 1, backups: records }));
    },
    logError: () => {},
  });

  await assert.rejects(service.createDatabaseBackup(), /metadata could not be saved/i);
  const [backup] = await service.listBackupHistory();
  assert.equal(backup.creationResult, 'failed');
  assert.equal(backup.validationStatus, 'failed');
  assert.match(backup.validationDetails, /metadata could not be saved/i);
});

test('failed operation removes only its owned temporary file and preserves unrelated files', async () => {
  saveEnvironment();
  const root = await createRoot();
  const oldTemporary = path.join(root, '.skillsync-database-20261108-153049-050-00000000000000000000000000000000.tmp');
  const unrelatedTemporary = path.join(root, '.skillsync-database-20261108-153049-051-11111111111111111111111111111111.tmp');
  let ownedTemporaryPath;
  await fs.writeFile(oldTemporary, 'pre-existing');
  const service = createBackupService({
    backupRoot: () => root,
    runScript: async (_destination, operationTemporaryPath) => {
      ownedTemporaryPath = operationTemporaryPath;
      await fs.writeFile(ownedTemporaryPath, 'owned partial output');
      await fs.writeFile(unrelatedTemporary, 'manual PowerShell backup output');
      throw new Error('Synthetic process failure');
    },
    logError: () => {},
  });

  await assert.rejects(service.createDatabaseBackup());
  assert.equal(await fs.readFile(oldTemporary, 'utf8'), 'pre-existing');
  assert.equal(await fs.readFile(unrelatedTemporary, 'utf8'), 'manual PowerShell backup output');
  await assert.rejects(fs.access(ownedTemporaryPath), { code: 'ENOENT' });
});
