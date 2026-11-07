const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

const testDatabaseUrl = process.env.SKILLSYNC_TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  test('registration persistence requires SKILLSYNC_TEST_DATABASE_URL', { skip: true }, () => {});
} else {
  if (!/^file:.*test/i.test(testDatabaseUrl)) {
    throw new Error('SKILLSYNC_TEST_DATABASE_URL must be an isolated SQLite URL containing "test" in its path.');
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'registration-integration-test-secret-that-is-long-enough';

  const prisma = require('../../dist/config/database').default;
  const authRoutes = require('../../dist/routes/auth').default;
  const { errorHandler } = require('../../dist/middleware/errorHandler');
  const { verifyPassword } = require('../../dist/utils/password');

  const suffix = `${process.pid}-${Date.now()}`;
  const createdEmails = [];
  let server;
  let baseUrl;

  const register = async (fields) => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    return { response, body: await response.json() };
  };

  const baseRegistration = (email, fields = {}) => ({
    email,
    password: 'Synthetic-Registration-Pass-2026!',
    firstName: 'Amara',
    lastName: 'Ndlovu',
    ...fields,
  });

  before(async () => {
    await prisma.$connect();
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await prisma.$disconnect();
  });

  test('registration validates identity data and persists normalized accounts', async (t) => {
    const invalidCases = [
      ['digit-first-name', { firstName: '123' }],
      ['digit-last-name', { lastName: '333' }],
      ['blank-first-name', { firstName: '   ' }],
      ['blank-last-name', { lastName: '\t\n' }],
      ['punctuation-name', { firstName: '!!!' }],
      ['employer-digit-name', { firstName: '123', role: 'EMPLOYER' }],
      ['long-name', { lastName: 'N'.repeat(81) }],
      ['blank-university', { university: '   ' }],
      ['punctuation-university', { university: '---...' }],
      ['long-university', { university: 'U'.repeat(161) }],
    ];

    for (const [label, fields] of invalidCases) {
      const email = `${label}.${suffix}@skillsync.test`;
      const { response } = await register(baseRegistration(email, fields));
      assert.equal(response.status, 400, label);
      assert.equal(await prisma.user.count({ where: { email } }), 0, label);
    }

    const email = `jose.${suffix}@skillsync.test`;
    createdEmails.push(email.toLowerCase());
    const { response, body } = await register(baseRegistration(email.toUpperCase(), {
      firstName: '  José Anne-Marie  ',
      lastName: " O'Connor 李 ",
      university: '  École 42 — Paris  ',
    }));
    assert.equal(response.status, 201);
    assert.equal(body.data.user.email, email.toLowerCase());

    const persisted = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: true },
    });
    assert.ok(persisted);
    assert.equal(persisted.role, 'STUDENT');
    assert.equal(persisted.studentProfile.firstName, 'José Anne-Marie');
    assert.equal(persisted.studentProfile.lastName, "O'Connor 李");
    assert.equal(persisted.studentProfile.university, 'École 42 — Paris');
    assert.equal(await verifyPassword('Synthetic-Registration-Pass-2026!', persisted.password), true);

    const omittedUniversityEmail = `omitted-university.${suffix}@skillsync.test`;
    createdEmails.push(omittedUniversityEmail);
    const omittedUniversity = await register(baseRegistration(omittedUniversityEmail));
    assert.equal(omittedUniversity.response.status, 201);
    const omittedProfile = await prisma.studentProfile.findUnique({
      where: { userId: omittedUniversity.body.data.user.id },
    });
    assert.equal(omittedProfile.university, '');

    const employerEmail = `employer.${suffix}@skillsync.test`;
    createdEmails.push(employerEmail);
    const employerRegistration = await register(baseRegistration(employerEmail, {
      firstName: '  Mei  ',
      lastName: ' Tanaka ',
      companyName: '  Cape Digital Labs  ',
      role: 'EMPLOYER',
    }));
    assert.equal(employerRegistration.response.status, 201);
    const persistedEmployer = await prisma.user.findUnique({
      where: { email: employerEmail },
      include: { employerProfile: true },
    });
    assert.equal(persistedEmployer.role, 'EMPLOYER');
    assert.equal(persistedEmployer.employerProfile.companyName, 'Cape Digital Labs');

    const duplicate = await register(baseRegistration(email));
    assert.equal(duplicate.response.status, 409);
    assert.equal(await prisma.user.count({ where: { email: email.toLowerCase() } }), 1);

    const shortPassword = await register(baseRegistration(`short-password.${suffix}@skillsync.test`, {
      password: 'short',
    }));
    assert.equal(shortPassword.response.status, 400);
    const restrictedRoleEmail = `admin-role.${suffix}@skillsync.test`;
    const restrictedRole = await register(baseRegistration(restrictedRoleEmail, { role: 'ADMIN' }));
    assert.equal(restrictedRole.response.status, 400);
    assert.equal(await prisma.user.count({ where: { email: restrictedRoleEmail } }), 0);
  });

  test('student and employer registration reject passwords that fail complexity requirements', async () => {
    const invalidPasswords = [
      '000000000000',
      'abcdefghijkl',
      'ABCDEFGHIJKL',
      'Password1234',
      'PasswordOnly!',
      '1234567890!@',
      'password123!',
      'PASSWORD123!',
      'Password!!!!',
      'Password 1234',
      '',
    ];

    for (const role of ['STUDENT', 'EMPLOYER']) {
      for (const [index, password] of invalidPasswords.entries()) {
        const email = `weak-${role.toLowerCase()}-${index}.${suffix}@skillsync.test`;
        const { response, body } = await register(baseRegistration(email, {
          password,
          role,
          ...(role === 'EMPLOYER' ? { companyName: 'Cape Digital Labs' } : { university: 'University of Cape Town' }),
        }));
        assert.equal(response.status, 400, `${role} password case ${index}`);
        if (password) {
          assert.equal(JSON.stringify(body).includes(password), false, `${role} password case ${index} echoed password`);
        }
        assert.equal(await prisma.user.count({ where: { email } }), 0, `${role} password case ${index} persisted`);
      }
    }
  });

  test('password reset rejects passwords that fail complexity requirements', async () => {
    const password = 'Password1234';
    const response = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64), password }),
    });
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.equal(body.includes(password), false);
    assert.match(body, /special character/);
  });
}
