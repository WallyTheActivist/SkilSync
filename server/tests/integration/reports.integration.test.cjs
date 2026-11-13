const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'reports-test-secret-that-is-long-enough';

const prisma = require('../../dist/config/database').default;
const reportsRouter = require('../../dist/routes/reports').default;
const { signToken } = require('../../dist/utils/jwt');
const { errorHandler } = require('../../dist/middleware/errorHandler');

const users = new Map([
  ['reports-admin', { id: 'reports-admin', email: 'admin@skillsync.test', role: 'ADMIN' }],
  ['reports-student', { id: 'reports-student', email: 'student@skillsync.test', role: 'STUDENT' }],
  ['reports-employer', { id: 'reports-employer', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }],
]);

const app = express();
app.use(express.json());
app.use('/reports', reportsRouter);
app.use(errorHandler);

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  prisma.user.findUnique = async ({ where }) => users.get(where.id) ?? null;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const mockMethod = (testContext, delegate, methodName, implementation) => {
  const original = delegate[methodName];
  delegate[methodName] = implementation;
  testContext.after(() => { delegate[methodName] = original; });
};

const requestAs = (userId, path) => {
  const user = users.get(userId);
  const token = signToken({ userId, email: user.email, role: user.role });
  return fetch(`${baseUrl}/reports${path}`, { headers: { Authorization: `Bearer ${token}` } });
};

const reportPaths = [
  '/dashboard',
  '/student-readiness',
  '/student-readiness/student-profile-test-001',
  '/internship-match',
  '/application-statistics',
  '/application-statistics?export=pdf',
  '/skills-demand',
];

test('admin can access every report endpoint', async (t) => {
  mockMethod(t, prisma.studentProfile, 'findMany', async () => []);
  mockMethod(t, prisma.application, 'findMany', async () => []);
  mockMethod(t, prisma.skill, 'findMany', async () => []);

  for (const path of reportPaths) {
    const response = await requestAs('reports-admin', path);
    assert.equal(response.status, 200, `${path} should be available to an admin`);
  }
});

test('student and employer cannot access any report endpoint', async () => {
  for (const userId of ['reports-student', 'reports-employer']) {
    for (const path of reportPaths) {
      const response = await requestAs(userId, path);
      assert.equal(response.status, 403, `${userId} should be denied ${path}`);
    }
  }
});

test('report endpoints require authentication', async () => {
  for (const path of reportPaths) {
    const response = await fetch(`${baseUrl}/reports${path}`);
    assert.equal(response.status, 401, `${path} should require authentication`);
  }
});

test('report endpoints reject an admin token after the database role changes', async () => {
  const token = signToken({
    userId: 'reports-admin',
    email: 'admin@skillsync.test',
    role: 'ADMIN',
  });
  users.set('reports-admin', { ...users.get('reports-admin'), role: 'STUDENT' });

  try {
    const response = await fetch(`${baseUrl}/reports/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
  } finally {
    users.set('reports-admin', { ...users.get('reports-admin'), role: 'ADMIN' });
  }
});

test('application report counts all rows and aggregates every stored status', async (t) => {
  const records = [
    { status: 'ACCEPTED', internship: { id: 'internship-a', title: 'Platform Engineer' } },
    { status: 'PENDING', internship: { id: 'internship-a', title: 'Platform Engineer' } },
    { status: 'REJECTED', internship: { id: 'internship-b', title: 'Data Analyst' } },
    { status: 'WITHDRAWN', internship: { id: 'internship-a', title: 'Platform Engineer' } },
  ];
  let query;
  mockMethod(t, prisma.application, 'findMany', async (args) => {
    query = args;
    return records;
  });

  const response = await requestAs('reports-admin', '/application-statistics');
  const { data } = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.totalApplications, 4);
  assert.deepEqual(data.byStatus, { ACCEPTED: 1, PENDING: 1, REJECTED: 1, WITHDRAWN: 1 });
  assert.equal(data.acceptanceRate, 25);
  assert.equal(data.averageTimeToDecision, null);
  assert.deepEqual(data.topInternships, [
    { title: 'Platform Engineer', applications: 3 },
    { title: 'Data Analyst', applications: 1 },
  ]);
  assert.equal(query.take, undefined);
  assert.equal(query.skip, undefined);
});

test('application report returns safe zero values for an empty dataset', async (t) => {
  mockMethod(t, prisma.application, 'findMany', async () => []);

  const response = await requestAs('reports-admin', '/application-statistics');
  const { data } = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.totalApplications, 0);
  assert.deepEqual(data.byStatus, {});
  assert.equal(data.acceptanceRate, 0);
  assert.equal(data.averageTimeToDecision, null);
  assert.deepEqual(data.topInternships, []);
});

test('admin can export a report as a PDF', async (t) => {
  mockMethod(t, prisma.application, 'findMany', async () => []);

  const response = await requestAs('reports-admin', '/application-statistics?export=pdf');
  const pdf = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('readiness report includes all student profiles and handles an empty dataset', async (t) => {
  const allProfiles = [
    {
      id: 'profile-a',
      firstName: 'A',
      lastName: 'Student',
      readinessScore: 65,
      studentSkills: [{ skill: { name: 'TypeScript' }, proficiency: 'INTERMEDIATE' }],
      applications: [{ id: 'app-a' }],
    },
    {
      id: 'profile-b',
      firstName: 'B',
      lastName: 'Student',
      readinessScore: 0,
      studentSkills: [],
      applications: [],
    },
  ];
  let query;
  mockMethod(t, prisma.studentProfile, 'findMany', async (args) => {
    query = args;
    return allProfiles;
  });

  const response = await requestAs('reports-admin', '/student-readiness');
  const { data } = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.length, 2);
  assert.equal(data[0].skillCount, 1);
  assert.equal(data[0].applicationCount, 1);
  assert.equal(query.take, undefined);
  assert.equal(query.skip, undefined);

  mockMethod(t, prisma.studentProfile, 'findMany', async () => []);
  const emptyResponse = await requestAs('reports-admin', '/student-readiness');
  assert.deepEqual((await emptyResponse.json()).data, []);
});

test('skills demand counts active requirements and labels pressure rather than temporal trend', async (t) => {
  let query;
  mockMethod(t, prisma.skill, 'findMany', async (args) => {
    query = args;
    return [{
      name: 'TypeScript',
      category: 'PROGRAMMING',
      internshipSkills: [{ id: 'active-req-1' }, { id: 'active-req-2' }],
      studentSkills: [{ id: 'student-skill-1' }],
    }];
  });

  const response = await requestAs('reports-admin', '/skills-demand');
  const { data } = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(query.include.internshipSkills.where, { internship: { status: 'ACTIVE' } });
  assert.equal(data[0].demandCount, 2);
  assert.equal(data[0].availableStudents, 1);
  assert.equal(data[0].gap, 1);
  assert.equal(data[0].demandPressure, 'high');
  assert.equal(Object.hasOwn(data[0], 'trend'), false);
});

test('report query failures return a safe error response', async (t) => {
  mockMethod(t, prisma.application, 'findMany', async () => {
    throw new Error('Prisma database password and query details');
  });

  const response = await requestAs('reports-admin', '/application-statistics');
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.match(body.error, /Unable to generate report/i);
  assert.doesNotMatch(JSON.stringify(body), /Prisma|password|query details/i);
});
