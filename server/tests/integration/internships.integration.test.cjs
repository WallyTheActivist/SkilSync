const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'internship-detail-test-secret-that-is-long-enough';

const prisma = require('../../dist/config/database').default;
const internshipRouter = require('../../dist/routes/internships').default;
const matchingService = require('../../dist/services/matchingService').default;
const { signToken } = require('../../dist/utils/jwt');
const { errorHandler } = require('../../dist/middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/internships', internshipRouter);
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

const mockMethod = (testContext, delegate, methodName, implementation) => {
  const original = delegate[methodName];
  delegate[methodName] = implementation;
  testContext.after(() => { delegate[methodName] = original; });
};

const tokenFor = (role = 'STUDENT') => signToken({
  userId: `${role.toLowerCase()}-user-test-001`,
  email: `${role.toLowerCase()}@skillsync.test`,
  role,
});

const getInternship = (id, token) => fetch(`${baseUrl}/internships/${id}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
}).then(async (response) => ({ response, body: await response.json() }));

const getMatchScore = (id, token) => fetch(`${baseUrl}/internships/${id}/match-score`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
}).then(async (response) => ({ response, body: await response.json() }));

const detail = {
  id: 'internship-test-001',
  title: 'DevOps Engineer Intern',
  description: 'Build deployment pipelines.',
  responsibilities: 'Automate deployments.',
  requirements: 'Linux and Docker.',
  employer: { companyName: 'CloudNine Systems' },
  requiredSkills: [{ skill: { name: 'Docker' }, importance: 5 }],
  _count: { applications: 2 },
};

test('returns the selected internship with detail-page relations', async (t) => {
  let lookup;
  mockMethod(t, prisma.internship, 'findUnique', async (args) => {
    lookup = args;
    return detail;
  });

  const { response, body } = await getInternship(detail.id);
  assert.equal(response.status, 200);
  assert.equal(body.data.id, detail.id);
  assert.equal(body.data.title, detail.title);
  assert.equal(body.data.employer.companyName, 'CloudNine Systems');
  assert.equal(body.data.requiredSkills[0].skill.name, 'Docker');
  assert.deepEqual(lookup.where, { id: detail.id });
  assert.ok(lookup.include.employer);
  assert.ok(lookup.include.requiredSkills);
});

test('returns 404 for an internship ID that does not exist', async (t) => {
  mockMethod(t, prisma.internship, 'findUnique', async () => null);
  const { response, body } = await getInternship('missing-internship');
  assert.equal(response.status, 404);
  assert.equal(body.message, 'Internship not found.');
});

test('rejects invalid oversized IDs before querying the database', async (t) => {
  let queried = false;
  mockMethod(t, prisma.internship, 'findUnique', async () => {
    queried = true;
    return null;
  });

  const { response, body } = await getInternship('x'.repeat(129));
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(queried, false);
});

test('returns a safe server error when the internship database lookup fails', async (t) => {
  mockMethod(t, prisma.internship, 'findUnique', async () => {
    throw new Error('database connection details are private');
  });

  const { response, body } = await getInternship(detail.id);
  assert.equal(response.status, 500);
  assert.equal(body.message, 'An unexpected error occurred. Please try again.');
});

test('requires authentication for student match-score functionality', async () => {
  const { response, body } = await getMatchScore(detail.id);
  assert.equal(response.status, 401);
  assert.equal(body.message, 'Authentication required. Please log in.');
});

test('allows an authenticated student to retrieve the internship match score', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'student-user-test-001',
    email: 'student@skillsync.test',
    role: 'STUDENT',
  }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, matchingService, 'calculateMatchScore', async (_profileId, internshipId) => ({
    overall: internshipId === detail.id ? 80 : null,
    breakdown: { matched: [], missing: [], bonus: [] },
    label: 'Strong Match',
    stats: { fullMatches: 1, partialMatches: 0, missingCount: 0, earnedPoints: 4, maxPoints: 5 },
  }));

  const { response, body } = await getMatchScore(detail.id, tokenFor());
  assert.equal(response.status, 200);
  assert.equal(body.data.overall, 80);
});

test('does not grant employers student-only match-score access', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001',
    email: 'employer@skillsync.test',
    role: 'EMPLOYER',
  }));

  const { response, body } = await getMatchScore(detail.id, tokenFor('EMPLOYER'));
  assert.equal(response.status, 403);
  assert.equal(body.message, 'You do not have permission to perform this action.');
});
