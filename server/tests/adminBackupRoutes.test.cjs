const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { after, before, test } = require('node:test');
const express = require('express');

process.env.JWT_SECRET = 'admin-backup-route-test-secret-long-enough';
process.env.NODE_ENV = 'test';

const prisma = require('../dist/config/database').default;
const backupService = require('../dist/services/backupService');
const { BackupConflictError, BackupIntegrityError } = backupService;
const { signToken } = require('../dist/utils/jwt');
const { errorHandler } = require('../dist/middleware/errorHandler');

const users = new Map([
  ['admin-user', { id: 'admin-user', email: 'admin@example.test', role: 'ADMIN' }],
  ['student-user', { id: 'student-user', email: 'student@example.test', role: 'STUDENT' }],
]);
prisma.user.findUnique = async ({ where }) => users.get(where.id) ?? null;

const originalMethods = {
  createDatabaseBackup: backupService.createDatabaseBackup,
  getBackupStatusSummary: backupService.getBackupStatusSummary,
  listBackupHistory: backupService.listBackupHistory,
  openVerifiedBackup: backupService.openVerifiedBackup,
};

const app = express();
app.use(express.json());
app.use('/admin', require('../dist/routes/admin').default);
app.use(errorHandler);

let server;
let baseUrl;
let downloadDirectory;

const tokenFor = (id, role) => signToken({
  userId: id,
  email: users.get(id).email,
  role,
});

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/admin`;
  downloadDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'skillsync-admin-backup-routes-'));
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fsp.rm(downloadDirectory, { recursive: true, force: true });
  Object.assign(backupService, originalMethods);
  await prisma.$disconnect();
});

test('backup history requires authentication and administrator authorization', async (t) => {
  await t.test('unauthenticated requests are rejected', async () => {
    const response = await fetch(`${baseUrl}/backups`);
    assert.equal(response.status, 401);
  });

  await t.test('non-admin users are rejected', async () => {
    const response = await fetch(`${baseUrl}/backups`, {
      headers: { Authorization: `Bearer ${tokenFor('student-user', 'STUDENT')}` },
    });
    assert.equal(response.status, 403);
  });

  await t.test('non-admin users cannot start backup creation', async () => {
    let createCalls = 0;
    backupService.createDatabaseBackup = async () => {
      createCalls += 1;
      throw new Error('The protected controller should not be reached.');
    };
    const response = await fetch(`${baseUrl}/backups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenFor('student-user', 'STUDENT')}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(response.status, 403);
    assert.equal(createCalls, 0);
  });
});

test('create route ignores request-body destination overrides and uses only configured service behavior', async () => {
  let receivedArguments;
  backupService.createDatabaseBackup = async (...args) => {
    receivedArguments = args;
    return {
      backup: {
        id: 'backup-id',
        filename: 'skillsync-database-20261108-153049-050.sqlite',
        creationResult: 'succeeded',
        validationStatus: 'unknown',
      },
      message: 'Created, validation unconfirmed.',
    };
  };

  const response = await fetch(`${baseUrl}/backups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationDirectory: 'C:\\private\\arbitrary-folder' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.deepEqual(receivedArguments, []);
  assert.equal(JSON.stringify(body).includes('arbitrary-folder'), false);
});

test('a concurrent backup request returns HTTP 409', async () => {
  backupService.createDatabaseBackup = async () => { throw new BackupConflictError(); };
  const response = await fetch(`${baseUrl}/backups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /already in progress/i);
});

test('failed backup process produces a generic API error while retaining server diagnostics', async () => {
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args);
  backupService.createDatabaseBackup = async () => {
    throw new Error('Synthetic process failure at C:\\private\\source.db');
  };
  try {
    const response = await fetch(`${baseUrl}/backups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.message, 'Database backup could not be created.');
    assert.equal(JSON.stringify(body).includes('source.db'), false);
    assert.equal(
      loggedErrors.some((entry) => entry.some((detail) => detail instanceof Error && detail.message.includes('source.db'))),
      true,
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test('backup download stream errors return a safe error response without leaking paths', async () => {
  const filename = 'skillsync-database-20261108-153049-050.sqlite';
  let closed = false;
  backupService.openVerifiedBackup = async () => ({
    filename,
    sizeBytes: 16,
    handle: {
      createReadStream: () => Readable.from((async function* () {
        throw new Error('synthetic stream failure');
      })()),
      close: async () => { closed = true; },
    },
  });

  const response = await fetch(`${baseUrl}/backups/backup-id/download`, {
    headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
  });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.message, 'Unable to download the backup file.');
  assert.equal(JSON.stringify(body).includes(downloadDirectory), false);
  assert.equal(closed, true);
});

test('download stream success closes the already-verified file handle', async () => {
  const filename = 'skillsync-database-20261108-153049-050.sqlite';
  let closed = false;
  backupService.openVerifiedBackup = async () => ({
    filename,
    sizeBytes: 19,
    handle: {
      createReadStream: () => Readable.from(['verified file bytes']),
      close: async () => { closed = true; },
    },
  });

  const response = await fetch(`${baseUrl}/backups/backup-id/download`, {
    headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'verified file bytes');
  assert.equal(closed, true);
});

test('client disconnect closes the verified download handle', async () => {
  let closed = false;
  const controller = new AbortController();
  let startStream;
  const started = new Promise((resolve) => { startStream = resolve; });
  backupService.openVerifiedBackup = async () => ({
    filename: 'skillsync-database-20261108-153049-050.sqlite',
    sizeBytes: 100000,
    handle: {
      createReadStream: () => Readable.from((async function* () {
        startStream();
        while (true) {
          yield Buffer.from('x');
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      })()),
      close: async () => { closed = true; },
    },
  });

  const response = await fetch(`${baseUrl}/backups/backup-id/download`, {
    headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
    signal: controller.signal,
  });
  const reader = response.body.getReader();
  await Promise.race([reader.read(), started]);
  controller.abort();
  await assert.rejects(reader.read());
  for (let attempt = 0; attempt < 20 && !closed; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(closed, true);
});

test('download integrity errors return a safe conflict response', async () => {
  backupService.openVerifiedBackup = async () => {
    throw new BackupIntegrityError();
  };
  const response = await fetch(`${baseUrl}/backups/backup-id/download`, {
    headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, 'Backup integrity could not be verified.');
});

test('metadata persistence failures return a generic API error', async () => {
  backupService.createDatabaseBackup = async () => {
    throw new Error('Backup metadata could not be saved at C:\\private\\manifest.json');
  };
  const response = await fetch(`${baseUrl}/backups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.message, 'Database backup could not be created.');
  assert.equal(JSON.stringify(body).includes('manifest.json'), false);
});

test('manifest backup ID flows through history into a successful protected download', async () => {
  const previousBackupDirectory = process.env.SKILLSYNC_BACKUP_DIRECTORY;
  const backupRoot = path.join(downloadDirectory, 'manifest-flow');
  const filename = 'skillsync-database-20261108-153049-050.sqlite';
  const backupId = 'persisted-backup-id';
  const content = Buffer.from('synthetic persisted backup');
  await fsp.mkdir(backupRoot, { recursive: true });
  await fsp.writeFile(path.join(backupRoot, filename), content);
  await fsp.writeFile(path.join(backupRoot, 'manifest.json'), JSON.stringify({
    version: 1,
    backups: [{
      id: backupId,
      filename,
      sha256: createHash('sha256').update(content).digest('hex'),
      createdAt: new Date().toISOString(),
      sizeBytes: content.length,
      backupType: 'database',
      validationStatus: 'unknown',
      validationDetails: 'No confirmed validation metadata is available for this backup.',
      localStorageStatus: 'available',
      cloudSynchronizationStatus: 'not_configured',
      creationResult: 'succeeded',
    }],
  }));
  process.env.SKILLSYNC_BACKUP_DIRECTORY = backupRoot;
  Object.assign(backupService, originalMethods);
  let verifiedHandle;
  backupService.openVerifiedBackup = async (id) => {
    const opened = await originalMethods.openVerifiedBackup(id);
    verifiedHandle = opened.handle;
    return opened;
  };

  try {
    const historyResponse = await fetch(`${baseUrl}/backups`, {
      headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
    });
    assert.equal(historyResponse.status, 200);
    const historyBody = await historyResponse.json();
    const listedBackup = historyBody.data.backups[0];
    assert.equal(listedBackup.id, backupId);
    assert.equal(listedBackup.filename, filename);
    assert.equal(JSON.stringify(historyBody).includes(backupRoot), false);

    const downloadResponse = await fetch(`${baseUrl}/backups/${encodeURIComponent(listedBackup.id)}/download`, {
      headers: { Authorization: `Bearer ${tokenFor('admin-user', 'ADMIN')}` },
    });
    assert.equal(downloadResponse.status, 200);
    assert.match(downloadResponse.headers.get('content-disposition'), new RegExp(filename));
    assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), content);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await assert.rejects(verifiedHandle.stat(), { code: 'EBADF' });
  } finally {
    if (previousBackupDirectory === undefined) delete process.env.SKILLSYNC_BACKUP_DIRECTORY;
    else process.env.SKILLSYNC_BACKUP_DIRECTORY = previousBackupDirectory;
    Object.assign(backupService, originalMethods);
  }
});
