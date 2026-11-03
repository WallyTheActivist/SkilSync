const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getSeedCredentials } = require('../dist/utils/seedCredentials');

const configuredEnvironment = () => {
  const env = {
    NODE_ENV: 'development',
    SKILLSYNC_ALLOW_DEMO_SEED: 'true',
    DATABASE_URL: 'file:./dev.db',
  };

  for (let index = 1; index <= 5; index += 1) {
    env[`DEMO_EMPLOYER_${index}_EMAIL`] = `employer${index}@example.invalid`;
    env[`DEMO_EMPLOYER_${index}_PASSWORD`] = `Employer-${index}-Passphrase`;
  }
  for (let index = 1; index <= 2; index += 1) {
    env[`DEMO_STUDENT_${index}_EMAIL`] = `student${index}@example.invalid`;
    env[`DEMO_STUDENT_${index}_PASSWORD`] = `Student-${index}-Passphrase`;
  }
  env.DEMO_ADMIN_EMAIL = 'admin@example.invalid';
  env.DEMO_ADMIN_PASSWORD = 'Admin-Unique-Passphrase';
  return env;
};

test('requires development mode, explicit opt-in, and local SQLite before seeding', () => {
  const env = configuredEnvironment();

  assert.throws(() => getSeedCredentials({ ...env, NODE_ENV: 'production' }), /only when NODE_ENV is development/);
  assert.throws(() => getSeedCredentials({ ...env, SKILLSYNC_ALLOW_DEMO_SEED: undefined }), /explicitly enable demo seeding/);
  assert.throws(() => getSeedCredentials({ ...env, DATABASE_URL: 'postgresql://example.invalid/db' }), /local SQLite/);
  assert.throws(() => getSeedCredentials({ ...env, DATABASE_URL: 'file://server/share/db.sqlite' }), /local SQLite/);
});

test('requires explicit unique emails and minimum-length passwords for every seeded role', () => {
  const env = configuredEnvironment();
  delete env.DEMO_ADMIN_PASSWORD;
  assert.throws(() => getSeedCredentials(env), /requires DEMO_ADMIN_PASSWORD/);

  const shortPasswordEnv = configuredEnvironment();
  shortPasswordEnv.DEMO_ADMIN_PASSWORD = 'short';
  assert.throws(() => getSeedCredentials(shortPasswordEnv), /DEMO_ADMIN_PASSWORD must be 12-72 characters/);

  const oversizedPasswordEnv = configuredEnvironment();
  oversizedPasswordEnv.DEMO_ADMIN_PASSWORD = 'é'.repeat(37);
  assert.throws(() => getSeedCredentials(oversizedPasswordEnv), /no more than 72 UTF-8 bytes/);

  const duplicateEmailEnv = configuredEnvironment();
  duplicateEmailEnv.DEMO_STUDENT_1_EMAIL = duplicateEmailEnv.DEMO_ADMIN_EMAIL;
  assert.throws(() => getSeedCredentials(duplicateEmailEnv), /unique email address/);

  const duplicatePasswordEnv = configuredEnvironment();
  duplicatePasswordEnv.DEMO_STUDENT_1_PASSWORD = duplicatePasswordEnv.DEMO_ADMIN_PASSWORD;
  assert.throws(() => getSeedCredentials(duplicatePasswordEnv), /unique password/);
});

test('accepts explicitly configured unique credentials', () => {
  const env = configuredEnvironment();
  const credentials = getSeedCredentials(env);

  assert.equal(credentials.employers.length, 5);
  assert.equal(credentials.students.length, 2);
  assert.equal(credentials.admin.email, 'admin@example.invalid');
  assert.equal(credentials.admin.password, env.DEMO_ADMIN_PASSWORD);
});
