const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-test-signing';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const { authenticate, authorize } = require('../dist/middleware/auth');
const { createAuthRateLimiter, getAuthRateLimitSettings } = require('../dist/config/authRateLimit');
const { validateJsonBody, verifyRequestOrigin } = require('../dist/middleware/security');
const { signToken } = require('../dist/utils/jwt');
const { setAuthCookie } = require('../dist/utils/authCookie');
const { hashPassword, verifyPassword } = require('../dist/utils/password');
const { detectImageType } = require('../dist/middleware/upload');
const { errorHandler } = require('../dist/middleware/errorHandler');
const prisma = require('../dist/config/database').default;
const authRoutes = require('../dist/routes/auth').default;
const studentRoutes = require('../dist/routes/student').default;
const employerRoutes = require('../dist/routes/employer').default;

const testUsers = new Map([
  ['student-1', { id: 'student-1', email: 'student@example.com', role: 'STUDENT' }],
  ['employer-1', { id: 'employer-1', email: 'employer@example.com', role: 'EMPLOYER', emailVerified: true }],
  ['admin-1', { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' }],
]);
prisma.user.findUnique = async ({ where }) => testUsers.get(where.id) ?? null;

const app = express();
app.use(express.json());
app.use(verifyRequestOrigin);
app.use(validateJsonBody);
app.use('/auth', createAuthRateLimiter(getAuthRateLimitSettings({ NODE_ENV: 'development' })), authRoutes);
app.use('/student', studentRoutes);
app.use('/employer', employerRoutes);
app.post('/mutate', (_req, res) => res.status(200).json({ success: true }));
app.post('/cookie-mutate', (_req, res) => res.status(200).json({ success: true }));
app.get('/admin', authenticate, authorize('ADMIN'), (_req, res) => res.status(200).json({ success: true }));
app.get('/reports', authenticate, authorize('ADMIN'), (_req, res) => res.status(200).json({ success: true }));
app.get('/student-only', authenticate, authorize('STUDENT'), (_req, res) => res.status(200).json({ success: true }));
app.get('/employer-only', authenticate, authorize('EMPLOYER'), (_req, res) => res.status(200).json({ success: true }));
app.get('/failure', () => { throw new Error('sensitive internal detail'); });
app.use(errorHandler);

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('allows a mutation from the configured browser origin', async () => {
  const response = await fetch(`${baseUrl}/mutate`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Valid payload' }),
  });
  assert.equal(response.status, 200);
});

test('rejects cross-origin mutations', async () => {
  const response = await fetch(`${baseUrl}/mutate`, {
    method: 'POST',
    headers: { Origin: 'https://attacker.invalid', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'payload' }),
  });
  assert.equal(response.status, 403);
});

test('requires an origin for cookie-authenticated mutations', async () => {
  const response = await fetch(`${baseUrl}/cookie-mutate`, {
    method: 'POST',
    headers: { Cookie: 'ss_token=opaque', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'payload' }),
  });
  assert.equal(response.status, 403);
});

test('rejects non-object JSON payloads and prototype-pollution keys', async (t) => {
  await t.test('array root', async () => {
    const response = await fetch(`${baseUrl}/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['unexpected']),
    });
    assert.equal(response.status, 400);
  });

  await t.test('prototype key', async () => {
    const response = await fetch(`${baseUrl}/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"__proto__":{"admin":true}}',
    });
    assert.equal(response.status, 400);
  });
});

test('requires a valid token and restricts admin routes by role', async (t) => {
  await t.test('missing token', async () => {
    const response = await fetch(`${baseUrl}/admin`);
    assert.equal(response.status, 401);
  });

  await t.test('student token denied', async () => {
    const token = signToken({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
    const response = await fetch(`${baseUrl}/admin`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 403);
  });

  await t.test('admin token allowed', async () => {
    const token = signToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const response = await fetch(`${baseUrl}/admin`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
  });

  await t.test('HttpOnly session cookie allowed for authorized user', async () => {
    const token = signToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const response = await fetch(`${baseUrl}/admin`, { headers: { Cookie: `ss_token=${token}` } });
    assert.equal(response.status, 200);
  });

  await t.test('student cannot access administrator reports', async () => {
    const token = signToken({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
    const response = await fetch(`${baseUrl}/reports`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 403);
  });
});

test('rejects a valid JWT when its user no longer exists', async (t) => {
  await withUserLookup(t, async () => null, async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { Authorization: `Bearer ${makeToken('ADMIN', 'deleted-admin')}` },
    });
    assert.equal(response.status, 401);
    assert.match((await response.json()).message, /Invalid or expired token/);
  });
});

test('rejects a valid JWT whose role is stale', async (t) => {
  await withUserLookup(t, async () => ({ id: 'changed-role-user', email: 'user@example.com', role: 'STUDENT' }), async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { Authorization: `Bearer ${makeToken('ADMIN', 'changed-role-user')}` },
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.match(body.message, /Invalid or expired token/);
    assert.doesNotMatch(body.message, /STUDENT|ADMIN|role/i);
  });
});

test('matching current database roles preserve Student, Employer, and Admin access', async () => {
  const requests = [
    ['STUDENT', '/student-only'],
    ['EMPLOYER', '/employer-only'],
    ['ADMIN', '/admin'],
  ];

  for (const [role, route] of requests) {
    const response = await fetch(`${baseUrl}${route}`, {
      headers: { Authorization: `Bearer ${makeToken(role)}` },
    });
    assert.equal(response.status, 200, `${role} should access ${route}`);
  }
});

test('invalid, expired, and malformed tokens return 401 without querying the user', async (t) => {
  let lookupCount = 0;
  await withUserLookup(t, async () => {
    lookupCount += 1;
    return { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
  }, async () => {
    const expiredToken = jwt.sign(
      { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: -1 }
    );

    for (const token of ['invalid-token', 'not.a.jwt', expiredToken]) {
      const response = await fetch(`${baseUrl}/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 401);
    }
    assert.equal(lookupCount, 0);
  });
});

test('database lookup failures do not expose database details', async (t) => {
  await withUserLookup(t, async () => { throw new Error('sensitive database failure'); }, async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { Authorization: `Bearer ${makeToken('ADMIN')}` },
    });
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(body.includes('sensitive database failure'), false);
  });
});

test('server errors do not expose stack traces or internal messages', async () => {
  const response = await fetch(`${baseUrl}/failure`);
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(body.includes('sensitive internal detail'), false);
  assert.equal(body.includes('stack'), false);
});

test('auth cookies are HttpOnly and SameSite strict', () => {
  let cookieOptions;
  const response = { cookie: (_name, _token, options) => { cookieOptions = options; } };
  setAuthCookie(response, 'test-token');
  assert.equal(cookieOptions.httpOnly, true);
  assert.equal(cookieOptions.sameSite, 'strict');
  assert.equal(cookieOptions.path, '/api');
});

test('bcrypt password hashes verify correctly and do not expose plaintext', async () => {
  const plaintext = 'Long-enough-test-password-2026';
  const hash = await hashPassword(plaintext);
  assert.notEqual(hash, plaintext);
  assert.equal(await verifyPassword(plaintext, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('auth registration validates fields and does not echo secrets', async (t) => {
  await t.test('short password and invalid email', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short', firstName: 'Test', lastName: 'User', university: 'University of Cape Town' }),
    });
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.equal(body.includes('short'), false);
  });

  await t.test('public registration cannot assign admin role', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Long-enough-test-password-2026',
        firstName: 'Test',
        lastName: 'User',
        university: 'Test University',
        role: 'ADMIN',
      }),
    });
    assert.equal(response.status, 400);
  });
});

test('development auth rate-limit mode allows repeated login and registration attempts without bypassing validation', async () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' }),
    });
    assert.equal(loginResponse.status, 401);
    assert.match((await loginResponse.json()).message, /Invalid email or password/);

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'presenter@example.com',
        password: 'Long-enough-test-password-2026',
        firstName: 'Test',
        lastName: 'Presenter',
        university: 'Test University',
        role: 'ADMIN',
      }),
    });
    assert.equal(registerResponse.status, 400);
  }
});

test('valid login credentials authenticate successfully and invalid credentials do not', async (t) => {
  const password = 'Long-enough-test-password-2026';
  const passwordHash = await hashPassword(password);
  const account = {
    id: 'login-test-user',
    email: 'login@example.com',
    role: 'STUDENT',
    emailVerified: true,
    password: passwordHash,
    studentProfile: null,
    employerProfile: null,
  };

  await withUserLookup(t, async ({ where }) => where.email === account.email ? account : null, async () => {
    const invalidResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: 'incorrect-password' }),
    });
    assert.equal(invalidResponse.status, 401);

    const validResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email.toUpperCase(), password }),
    });
    assert.equal(validResponse.status, 200);
    assert.match(validResponse.headers.get('set-cookie'), /ss_token=.*HttpOnly/i);
    assert.equal((await validResponse.json()).data.user.role, 'STUDENT');
  });
});

test('verified employers can log in and establish an HttpOnly session', async (t) => {
  const password = 'Long-enough-test-password-2026';
  const account = {
    id: 'verified-employer-login',
    email: 'verified-employer@example.com',
    role: 'EMPLOYER',
    emailVerified: true,
    password: await hashPassword(password),
    studentProfile: null,
    employerProfile: { companyName: 'Synthetic Employer' },
  };

  await withUserLookup(t, async ({ where }) => (
    where.email === account.email || where.id === account.id ? account : testUsers.get(where.id) ?? null
  ), async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /ss_token=.*HttpOnly/i);
    assert.equal((await response.json()).data.user.role, 'EMPLOYER');
  });
});

test('unverified employers cannot log in or receive an authenticated session', async (t) => {
  const password = 'Long-enough-test-password-2026';
  const account = {
    id: 'unverified-employer-login',
    email: 'unverified-employer@example.com',
    role: 'EMPLOYER',
    emailVerified: false,
    password: await hashPassword(password),
    studentProfile: null,
    employerProfile: { companyName: 'Synthetic Employer' },
  };

  await withUserLookup(t, async ({ where }) => where.email === account.email ? account : null, async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'EMAIL_NOT_VERIFIED');
    assert.equal(response.headers.get('set-cookie'), null);
  });
});

test('administrator can log in and use an admin-protected route', async (t) => {
  const password = 'Long-enough-test-password-2026';
  const account = {
    id: 'login-test-admin',
    email: 'login-admin@example.com',
    role: 'ADMIN',
    emailVerified: true,
    password: await hashPassword(password),
    studentProfile: null,
    employerProfile: null,
  };

  await withUserLookup(t, async ({ where }) => (
    where.email === account.email || where.id === account.id ? account : testUsers.get(where.id) ?? null
  ), async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password }),
    });
    assert.equal(response.status, 200);
    const sessionCookie = response.headers.get('set-cookie');
    assert.match(sessionCookie, /ss_token=.*HttpOnly/i);
    assert.equal((await response.json()).data.user.role, 'ADMIN');

    const protectedResponse = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: sessionCookie.split(';')[0] },
    });
    assert.equal(protectedResponse.status, 200);
  });
});

test('login reports a safe temporary-unavailability message for Prisma schema errors', async (t) => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = async () => {
    const error = new Error('The column users.emailVerified does not exist.');
    error.code = 'P2022';
    throw error;
  };
  t.after(() => { prisma.user.findUnique = original; });

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@example.com', password: 'synthetic-password' }),
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.message, 'Login is temporarily unavailable. Please try again.');
  assert.equal(JSON.stringify(body).includes('emailVerified'), false);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('valid registration creates a normal account with a hashed password', async (t) => {
  const originalCreate = prisma.user.create;
  const originalTransaction = prisma.$transaction;
  let createdData;
  prisma.user.create = async ({ data }) => {
    createdData = data;
    return {
      id: 'registered-test-user',
      email: data.email,
      role: data.role,
      studentProfile: { firstName: 'Test', lastName: 'Presenter' },
      employerProfile: null,
    };
  };
  prisma.$transaction = async (callback) => callback({ user: { create: prisma.user.create } });
  t.after(() => { prisma.user.create = originalCreate; });
  t.after(() => { prisma.$transaction = originalTransaction; });

  await withUserLookup(t, async () => null, async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'presenter@example.com',
        password: 'Long-enough-test-password-2026',
        firstName: '  José Anne-Marie  ',
        lastName: " O'Connor 李 ",
        university: '  University of Cape Town  ',
      }),
    });
    assert.equal(response.status, 201);
    assert.equal(createdData.role, 'STUDENT');
    assert.equal(createdData.studentProfile.create.firstName, 'José Anne-Marie');
    assert.equal(createdData.studentProfile.create.lastName, "O'Connor 李");
    assert.equal(createdData.studentProfile.create.university, 'University of Cape Town');
    assert.notEqual(createdData.password, 'Long-enough-test-password-2026');
    assert.equal(await verifyPassword('Long-enough-test-password-2026', createdData.password), true);
  });
});

test('registration rejects malformed identity fields before account creation', async (t) => {
  const originalCreate = prisma.user.create;
  let createCalls = 0;
  prisma.user.create = async () => {
    createCalls += 1;
    throw new Error('Invalid registration reached account creation.');
  };
  t.after(() => { prisma.user.create = originalCreate; });

  const invalidFields = [
    { firstName: '123' },
    { lastName: '333' },
    { firstName: '   ' },
    { lastName: ' \t ' },
    { firstName: '!!!' },
    { lastName: 'x'.repeat(81) },
    { university: '   ' },
    { university: '---...' },
  ];

  await withUserLookup(t, async () => null, async () => {
    for (const [index, fields] of invalidFields.entries()) {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `invalid-identity-${index}@example.com`,
          password: 'Long-enough-test-password-2026',
          firstName: 'Valid',
          lastName: 'Person',
          ...fields,
        }),
      });
      assert.equal(response.status, 400, JSON.stringify(fields));
      const body = await response.json();
      assert.ok(body.errors.length > 0);
    }
  });
  assert.equal(createCalls, 0);
});

test('student profile updates reject malformed names and trim valid names', async (t) => {
  const originalUpdate = prisma.studentProfile.update;
  let updatedData;
  prisma.studentProfile.update = async ({ data }) => {
    updatedData = data;
    return { id: 'student-profile-test', ...data };
  };
  t.after(() => { prisma.studentProfile.update = originalUpdate; });
  const token = signToken({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });

  const invalidResponse = await fetch(`${baseUrl}/student/profile`, {
    method: 'PUT',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstName: '123' }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(updatedData, undefined);

  const validResponse = await fetch(`${baseUrl}/student/profile`, {
    method: 'PUT',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstName: ' Zoë ', lastName: " D'Arcy " }),
  });
  assert.equal(validResponse.status, 200);
  assert.equal(updatedData.firstName, 'Zoë');
  assert.equal(updatedData.lastName, "D'Arcy");
});

test('student profile rejects invalid numeric input before reaching the controller', async () => {
  const token = signToken({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
  const response = await fetch(`${baseUrl}/student/profile`, {
    method: 'PUT',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gpa: 'not-a-number' }),
  });
  const responseBody = await response.json();
  assert.equal(response.status, 400);
  assert.match(responseBody.errors[0], /gpa must be a number/);
});

test('file type detection rejects content that only claims to be an image', () => {
  assert.equal(detectImageType(Buffer.from('not an image')), null);
  assert.deepEqual(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {
    extension: '.jpg',
    mimeType: 'image/jpeg',
  });
});

test('student avatar rejects an image MIME type with non-image content', async () => {
  const token = signToken({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
  const form = new FormData();
  form.append('avatar', new Blob(['not an image'], { type: 'image/jpeg' }), 'avatar.jpg');
  const response = await fetch(`${baseUrl}/student/profile/avatar`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Authorization: `Bearer ${token}` },
    body: form,
  });
  const responseBody = await response.json();
  assert.equal(response.status, 400);
  assert.match(responseBody.message, /content must match/);
});

test('employer internship writes reject malformed values before controller access', async () => {
  const token = signToken({ userId: 'employer-1', email: 'employer@example.com', role: 'EMPLOYER' });
  const response = await fetch(`${baseUrl}/employer/internships`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Developer intern',
      description: 'Role description',
      durationMonths: 'three',
      applicationDeadline: 'not-a-date',
      skills: [],
    }),
  });
  const responseBody = await response.json();
  assert.equal(response.status, 400);
  assert.ok(responseBody.errors.length >= 1);
});

const withUserLookup = async (testContext, lookup, callback) => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = lookup;
  testContext.after(() => { prisma.user.findUnique = original; });
  await callback();
};

const makeToken = (role, userId = `${role.toLowerCase()}-1`) =>
  signToken({ userId, email: `${role.toLowerCase()}@example.com`, role });