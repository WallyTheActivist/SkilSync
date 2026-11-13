const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'application-test-secret-that-is-long-enough';

const prisma = require('../../dist/config/database').default;
const applicationsRouter = require('../../dist/routes/applications').default;
const employerRouter = require('../../dist/routes/employer').default;
const { signToken } = require('../../dist/utils/jwt');
const { errorHandler } = require('../../dist/middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/applications', applicationsRouter);
app.use('/employer', employerRouter);
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

const withdraw = (status, profileId = 'student-profile-test-001') => {
  const token = signToken({ userId: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' });
  return fetch(`${baseUrl}/applications/application-test-001/withdraw`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).then(async (response) => ({ response, body: await response.json(), profileId, status }));
};

const getDashboardApplications = () => {
  const token = signToken({ userId: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' });
  return fetch(`${baseUrl}/applications/my-applications/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => ({ response, body: await response.json() }));
};

const getMyApplications = () => {
  const token = signToken({ userId: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' });
  return fetch(`${baseUrl}/applications/my-applications`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => ({ response, body: await response.json() }));
};

const mockDashboardApplications = (testContext, ownedCount) => {
  mockMethod(testContext, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(testContext, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));

  const allApplications = [
    ...Array.from({ length: ownedCount }, (_, index) => ({
      id: `owned-application-${index}`,
      studentProfileId: 'student-profile-test-001',
    })),
    { id: 'other-student-application-1', studentProfileId: 'other-student-profile' },
    { id: 'other-student-application-2', studentProfileId: 'other-student-profile' },
  ];
  let listQuery;
  let countQuery;

  mockMethod(testContext, prisma.application, 'findMany', async (args) => {
    listQuery = args;
    return allApplications
      .filter((application) => application.studentProfileId === args.where.studentProfileId)
      .slice(0, args.take);
  });
  mockMethod(testContext, prisma.application, 'count', async (args) => {
    countQuery = args;
    return allApplications.filter((application) => application.studentProfileId === args.where.studentProfileId).length;
  });

  return { getListQuery: () => listQuery, getCountQuery: () => countQuery };
};

test('dashboard application total counts all of the student’s applications, independent of the recent list limit', async (t) => {
  for (const total of [0, 1, 3, 5]) {
    await t.test(`reports ${total} application${total === 1 ? '' : 's'}`, async (subtest) => {
      const queries = mockDashboardApplications(subtest, total);
      const { response, body } = await getDashboardApplications();

      assert.equal(response.status, 200);
      assert.equal(body.data.total, total);
      assert.equal(body.data.applications.length, Math.min(total, 3));
      assert.deepEqual(queries.getCountQuery().where, { studentProfileId: 'student-profile-test-001' });
      assert.deepEqual(queries.getListQuery().where, { studentProfileId: 'student-profile-test-001' });
      assert.equal(queries.getListQuery().take, 3);
    });
  }
});

test('student can withdraw a pending application owned by their profile', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.application, 'findFirst', async () => ({ id: 'application-test-001', status: 'PENDING' }));
  let updated;
  mockMethod(t, prisma.application, 'update', async (args) => {
    updated = args;
    return { id: args.where.id, status: args.data.status };
  });

  const { response, body } = await withdraw('PENDING');

  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'WITHDRAWN');
  assert.equal(updated.where.id, 'application-test-001');
});

test('student cannot withdraw a finalized application', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.application, 'findFirst', async () => ({ id: 'application-test-001', status: 'ACCEPTED' }));
  let updateCalled = false;
  mockMethod(t, prisma.application, 'update', async () => {
    updateCalled = true;
    return {};
  });

  const { response, body } = await withdraw('ACCEPTED');

  assert.equal(response.status, 409);
  assert.match(body.message, /cannot be withdrawn/i);
  assert.equal(updateCalled, false);
});

test('student cannot withdraw another profile’s application', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  let lookup;
  mockMethod(t, prisma.application, 'findFirst', async (args) => {
    lookup = args;
    return null;
  });

  const { response } = await withdraw('PENDING');

  assert.equal(response.status, 404);
  assert.deepEqual(lookup.where, { id: 'application-test-001', studentProfileId: 'student-profile-test-001' });
});

const apply = ({
  userId = 'student-user-test-001',
  profileId = 'student-profile-test-001',
  internshipId = 'internship-test-001',
  coverLetter = 'I am excited to apply.',
} = {}) => {
  const token = signToken({ userId, email: 'amara@skillsync.test', role: 'STUDENT' });
  return fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ internshipId, coverLetter }),
  }).then(async (response) => ({ response, body: await response.json() }));
};

const createMatchScore = (overall = 86) => ({
  overall,
  breakdown: { matched: [], missing: [], bonus: [] },
  label: overall === null ? 'Not enough information' : 'Strong Match',
  stats: { fullMatches: 0, partialMatches: 0, missingCount: 0, earnedPoints: 0, maxPoints: 0 },
});

const updateApplicationStatus = ({
  applicationId = 'application-test-001',
  status = 'UNDER_REVIEW',
  notes,
  role = 'EMPLOYER',
} = {}) => {
  const isEmployer = role === 'EMPLOYER';
  const token = signToken({
    userId: isEmployer ? 'employer-user-test-001' : 'student-user-test-001',
    email: isEmployer ? 'employer@skillsync.test' : 'amara@skillsync.test',
    role,
  });
  return fetch(`${baseUrl}/employer/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, ...(notes !== undefined && { notes }) }),
  }).then(async (response) => ({ response, body: await response.json() }));
};

const applicationLifecycleRequest = (action, applicationId = 'application-test-001', role = 'EMPLOYER') => {
  const isEmployer = role === 'EMPLOYER';
  const token = signToken({
    userId: isEmployer ? 'employer-user-test-001' : 'student-user-test-001',
    email: isEmployer ? 'employer@skillsync.test' : 'amara@skillsync.test',
    role,
  });
  return fetch(`${baseUrl}/employer/applications/${applicationId}/${action}`, {
    method: 'PATCH',
    headers: { Authorization: ['Bearer', token].join(' ') },
  }).then(async (response) => ({ response, body: await response.json() }));
};

const getArchivedApplicants = () => {
  const token = signToken({ userId: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER' });
  return fetch(`${baseUrl}/employer/internships/internship-test-001/applicants?lifecycle=closed`, {
    headers: { Authorization: ['Bearer', token].join(' ') },
  }).then(async (response) => ({ response, body: await response.json() }));
};

test('student can apply for a first internship', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => null);
  const matchingService = require('../../dist/services/matchingService').default;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => createMatchScore(88));

  let created;
  mockMethod(t, prisma.application, 'create', async (args) => {
    created = args;
    return {
      id: 'application-test-001',
      ...args.data,
      internship: { id: 'internship-test-001', employer: { companyName: 'Example Co' } },
    };
  });

  const { response, body } = await apply();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.message, 'Application submitted successfully.');
  assert.equal(body.data.matchScore, 88);
  assert.deepEqual(created.data, {
    studentProfileId: 'student-profile-test-001',
    internshipId: 'internship-test-001',
    coverLetter: 'I am excited to apply.',
    matchScore: 88,
  });
});

test('student application keeps its application-time match score after matching inputs change', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => null);

  const matchingService = require('../../dist/services/matchingService').default;
  let scoreCalculations = 0;
  let currentMatchScore = 88;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => {
    scoreCalculations += 1;
    return createMatchScore(currentMatchScore);
  });

  let storedApplication;
  mockMethod(t, prisma.application, 'create', async ({ data }) => {
    storedApplication = {
      id: 'application-test-001',
      ...data,
      appliedAt: new Date().toISOString(),
      internship: { id: 'internship-test-001', title: 'Original title', employer: { companyName: 'Example Co' } },
    };
    return storedApplication;
  });
  mockMethod(t, prisma.application, 'findMany', async () => [{
    ...storedApplication,
    internship: { ...storedApplication.internship, title: 'Updated title' },
  }]);

  const submitted = await apply();
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.data.matchScore, 88);
  assert.equal(scoreCalculations, 1);

  currentMatchScore = 12;
  const listed = await getMyApplications();
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.data[0].internship.title, 'Updated title');
  assert.equal(listed.body.data[0].matchScore, 88);
  assert.equal(scoreCalculations, 1);

  currentMatchScore = 34;
  const listedAfterAnotherRequirementChange = await getMyApplications();
  assert.equal(listedAfterAnotherRequirementChange.body.data[0].matchScore, 88);
  assert.equal(scoreCalculations, 1);
});

test('application stores no numeric match score when internship requirements are empty', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => null);
  const matchingService = require('../../dist/services/matchingService').default;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => createMatchScore(null));
  mockMethod(t, prisma.application, 'create', async ({ data }) => ({ id: 'application-test-001', ...data }));

  const { response, body } = await apply();

  assert.equal(response.status, 201);
  assert.equal(body.data.matchScore, null);
});

test('student cannot apply twice for the same internship', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({ id: 'existing-application', studentProfileId: 'student-profile-test-001', internshipId: 'internship-test-001' }));

  let createCalled = false;
  mockMethod(t, prisma.application, 'create', async () => {
    createCalled = true;
    return {};
  });

  const { response, body } = await apply();

  assert.equal(response.status, 409);
  assert.match(body.message, /already applied/i);
  assert.equal(createCalled, false);
});

test('database uniqueness error during application create is converted to 409 without leaking details', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => null);
  const matchingService = require('../../dist/services/matchingService').default;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => createMatchScore(72));
  mockMethod(t, prisma.application, 'create', async () => {
    const error = new Error('Unique constraint failed on the fields: (`studentProfileId`, `internshipId`)');
    error.code = 'P2002';
    throw error;
  });

  const { response, body } = await apply();

  assert.equal(response.status, 409);
  assert.match(body.message, /already applied/i);
  assert.doesNotMatch(JSON.stringify(body), /P2002|Unique constraint|studentProfileId|internshipId|Prisma/i);
});

test('different students can apply to the same internship', async (t) => {
  const userLookup = new Map([
    ['student-user-a', { id: 'student-user-a', email: 'a@skillsync.test', role: 'STUDENT' }],
    ['student-user-b', { id: 'student-user-b', email: 'b@skillsync.test', role: 'STUDENT' }],
  ]);
  const profileLookup = new Map([
    ['student-user-a', { id: 'student-profile-a' }],
    ['student-user-b', { id: 'student-profile-b' }],
  ]);

  mockMethod(t, prisma.user, 'findUnique', async ({ where }) => userLookup.get(where.id) ?? null);
  mockMethod(t, prisma.studentProfile, 'findUnique', async ({ where }) => profileLookup.get(where.userId) ?? null);
  mockMethod(t, prisma.internship, 'findUnique', async () => ({ id: 'internship-test-001', status: 'ACTIVE' }));
  mockMethod(t, prisma.application, 'findUnique', async () => null);
  const matchingService = require('../../dist/services/matchingService').default;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => createMatchScore(80));
  mockMethod(t, prisma.application, 'create', async ({ data }) => ({
    id: `application-${data.studentProfileId}`,
    ...data,
    internship: { id: data.internshipId, employer: { companyName: 'Example Co' } },
  }));

  const first = await apply({ userId: 'student-user-a', profileId: 'student-profile-a' });
  const second = await apply({ userId: 'student-user-b', profileId: 'student-profile-b' });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.notEqual(first.body.data.studentProfileId, second.body.data.studentProfileId);
});

test('same student can apply to different internships', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  const internshipLookup = new Map([
    ['internship-test-001', { id: 'internship-test-001', status: 'ACTIVE' }],
    ['internship-test-002', { id: 'internship-test-002', status: 'ACTIVE' }],
  ]);
  mockMethod(t, prisma.internship, 'findUnique', async ({ where }) => internshipLookup.get(where.id) ?? null);
  mockMethod(t, prisma.application, 'findUnique', async () => null);
  const matchingService = require('../../dist/services/matchingService').default;
  mockMethod(t, matchingService, 'calculateMatchScore', async () => createMatchScore(70));
  mockMethod(t, prisma.application, 'create', async ({ data }) => ({
    id: `app-${data.internshipId}`,
    ...data,
    internship: { id: data.internshipId, employer: { companyName: 'Example Co' } },
  }));

  const first = await apply({ internshipId: 'internship-test-001' });
  const second = await apply({ internshipId: 'internship-test-002' });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.notEqual(first.body.data.internshipId, second.body.data.internshipId);
});

test('application creation still requires student authentication', async (t) => {
  const response = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ internshipId: 'internship-test-001' }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(body.message, /log in|authentication/i);
});

test('employer can advance an application to a valid next status', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    status: 'PENDING',
    internship: { employerProfileId: 'employer-profile-test-001' },
  }));

  let updated;
  mockMethod(t, prisma.application, 'update', async (args) => {
    updated = args;
    return { id: 'application-test-001', status: args.data.status, notes: args.data.notes ?? null };
  });

  const { response, body } = await updateApplicationStatus({ status: 'UNDER_REVIEW' });

  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'UNDER_REVIEW');
  assert.deepEqual(updated.data, { status: 'UNDER_REVIEW' });
});

test('employer can reject an application that belongs to their internship', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async ({ where }) => ({
    id: where.id,
    status: 'PENDING',
    internship: { employerProfileId: 'employer-profile-test-001' },
  }));

  let updated;
  mockMethod(t, prisma.application, 'update', async (args) => {
    updated = args;
    return { id: args.where.id, status: args.data.status };
  });

  const { response, body } = await updateApplicationStatus({ status: 'REJECTED' });

  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'REJECTED');
  assert.deepEqual(updated.where, { id: 'application-test-001' });
  assert.deepEqual(updated.data, { status: 'REJECTED' });
});

test('employer can accept an application that belongs to their internship', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    status: 'PENDING',
    internship: { employerProfileId: 'employer-profile-test-001' },
  }));

  let updated;
  mockMethod(t, prisma.application, 'update', async (args) => {
    updated = args;
    return { id: 'application-test-001', status: args.data.status };
  });

  const { response, body } = await updateApplicationStatus({ status: 'ACCEPTED' });

  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'ACCEPTED');
  assert.deepEqual(updated.where, { id: 'application-test-001' });
});

test('employer cannot update an application belonging to another employer', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    status: 'PENDING',
    internship: { employerProfileId: 'another-employer-profile' },
  }));

  let updateCalled = false;
  mockMethod(t, prisma.application, 'update', async () => {
    updateCalled = true;
    return {};
  });

  const { response, body } = await updateApplicationStatus({ status: 'REJECTED' });

  assert.equal(response.status, 403);
  assert.match(body.message, /not authorized/i);
  assert.equal(updateCalled, false);
});

test('student cannot update application status through the employer endpoint', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT' }));

  let applicationLookupCalled = false;
  mockMethod(t, prisma.application, 'findUnique', async () => {
    applicationLookupCalled = true;
    return null;
  });

  const { response, body } = await updateApplicationStatus({ status: 'REJECTED', role: 'STUDENT' });

  assert.equal(response.status, 403);
  assert.match(body.message, /permission/i);
  assert.equal(applicationLookupCalled, false);
});

test('unauthenticated requests cannot update application status', async () => {
  const response = await fetch(`${baseUrl}/employer/applications/application-test-001/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'REJECTED' }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(body.message, /authentication/i);
});

test('employer endpoint rejects invalid application statuses', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));

  let applicationLookupCalled = false;
  mockMethod(t, prisma.application, 'findUnique', async () => {
    applicationLookupCalled = true;
    return null;
  });

  const { response, body } = await updateApplicationStatus({ status: 'Rejected' });

  assert.equal(response.status, 400);
  assert.match(body.message, /invalid request/i);
  assert.equal(applicationLookupCalled, false);
});

test('updating one application does not modify another application', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  const applications = new Map([
    ['application-test-001', { id: 'application-test-001', status: 'PENDING', internship: { employerProfileId: 'employer-profile-test-001' } }],
    ['application-test-002', { id: 'application-test-002', status: 'PENDING', internship: { employerProfileId: 'employer-profile-test-001' } }],
  ]);
  mockMethod(t, prisma.application, 'findUnique', async ({ where }) => applications.get(where.id) ?? null);
  mockMethod(t, prisma.application, 'update', async ({ where, data }) => {
    const application = applications.get(where.id);
    application.status = data.status;
    return application;
  });

  const { response, body } = await updateApplicationStatus({
    applicationId: 'application-test-001',
    status: 'REJECTED',
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.id, 'application-test-001');
  assert.equal(applications.get('application-test-001').status, 'REJECTED');
  assert.equal(applications.get('application-test-002').status, 'PENDING');
});

test('employer cannot perform an invalid status transition', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    status: 'ACCEPTED',
    internship: { employerProfileId: 'employer-profile-test-001' },
  }));

  let updateCalled = false;
  mockMethod(t, prisma.application, 'update', async () => {
    updateCalled = true;
    return {};
  });

  const { response, body } = await updateApplicationStatus({ status: 'REJECTED' });

  assert.equal(response.status, 409);
  assert.match(body.message, /transition|cannot be moved/i);
  assert.equal(updateCalled, false);
});

test('closing an accepted application preserves the same application for the student', async (t) => {
  const application = {
    id: 'application-test-001',
    studentProfileId: 'student-profile-test-001',
    internshipId: 'internship-test-001',
    status: 'ACCEPTED',
    matchScore: 87,
    appliedAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    closedAt: null,
    internship: {
      id: 'internship-test-001',
      title: 'Analyst Internship',
      employerProfileId: 'employer-profile-test-001',
    },
  };
  mockMethod(t, prisma.user, 'findUnique', async ({ where }) => ({
    id: where.id,
    email: 'user@skillsync.test',
    role: where.id === 'employer-user-test-001' ? 'EMPLOYER' : 'STUDENT',
    emailVerified: true,
  }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.studentProfile, 'findUnique', async () => ({ id: 'student-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => application);
  let updateQuery;
  mockMethod(t, prisma.application, 'updateMany', async (args) => {
    updateQuery = args;
    application.closedAt = args.data.closedAt;
    return { count: 1 };
  });
  mockMethod(t, prisma.application, 'findMany', async () => [application]);

  const { response, body } = await applicationLifecycleRequest('close');
  assert.equal(response.status, 200);
  assert.equal(body.data.id, 'application-test-001');
  assert.equal(body.data.status, 'ACCEPTED');
  assert.ok(body.data.closedAt);
  assert.deepEqual(updateQuery.where, { id: application.id, closedAt: null });
  assert.equal(new Date(updateQuery.data.closedAt).toISOString(), body.data.closedAt);

  const studentResponse = await getMyApplications();
  assert.equal(studentResponse.response.status, 200);
  assert.equal(studentResponse.body.data.length, 1);
  assert.equal(studentResponse.body.data[0].id, 'application-test-001');
  assert.equal(studentResponse.body.data[0].studentProfileId, 'student-profile-test-001');
  assert.equal(studentResponse.body.data[0].internshipId, 'internship-test-001');
  assert.equal(studentResponse.body.data[0].status, 'ACCEPTED');
  assert.equal(studentResponse.body.data[0].matchScore, 87);
  assert.equal(studentResponse.body.data[0].internship.id, 'internship-test-001');
  assert.equal(studentResponse.body.data[0].internship.title, 'Analyst Internship');
  assert.equal(studentResponse.body.data[0].closedAt, body.data.closedAt);
  assert.equal(application.appliedAt, '2026-10-01T10:00:00.000Z');
  assert.equal(application.studentProfileId, 'student-profile-test-001');
  assert.equal(application.internship.id, 'internship-test-001');
});

test('employer cannot close another employer’s application', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true,
  }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    closedAt: null,
    internship: { employerProfileId: 'another-employer-profile' },
  }));
  let updateCalled = false;
  mockMethod(t, prisma.application, 'updateMany', async () => {
    updateCalled = true;
    return { count: 1 };
  });

  const { response, body } = await applicationLifecycleRequest('close');
  assert.equal(response.status, 403);
  assert.match(body.message, /not authorized/i);
  assert.equal(updateCalled, false);
});

test('unverified employer cannot close applications', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: false,
  }));
  let profileLookupCalled = false;
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => {
    profileLookupCalled = true;
    return { id: 'employer-profile-test-001' };
  });

  const { response, body } = await applicationLifecycleRequest('close');
  assert.equal(response.status, 403);
  assert.equal(body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(profileLookupCalled, false);
});

test('repeated closure requests preserve the original closure timestamp', async (t) => {
  const closureTime = '2026-11-01T12:00:00.000Z';
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true,
  }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.application, 'findUnique', async () => ({
    id: 'application-test-001',
    status: 'ACCEPTED',
    closedAt: closureTime,
    internship: { employerProfileId: 'employer-profile-test-001' },
  }));
  let updateCalled = false;
  mockMethod(t, prisma.application, 'updateMany', async () => {
    updateCalled = true;
    return { count: 1 };
  });

  const { response, body } = await applicationLifecycleRequest('close');
  assert.equal(response.status, 200);
  assert.equal(body.data.closedAt, closureTime);
  assert.equal(updateCalled, false);
});

test('archived applications are returned in the employer archived view', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true,
  }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findFirst', async () => ({
    id: 'internship-test-001', employerProfileId: 'employer-profile-test-001',
  }));
  let listQuery;
  mockMethod(t, prisma.application, 'findMany', async (args) => {
    listQuery = args;
    return [{ id: 'application-test-001', status: 'REJECTED', closedAt: new Date(), internship: { title: 'Analyst Intern' } }];
  });

  const { response, body } = await getArchivedApplicants();
  assert.equal(response.status, 200);
  assert.equal(body.data[0].status, 'REJECTED');
  assert.ok(body.data[0].closedAt);
  assert.equal(body.data[0].internship.title, 'Analyst Intern');
  assert.deepEqual(listQuery.where, { internshipId: 'internship-test-001', closedAt: { not: null } });
});

test('students cannot close applications through employer endpoints', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'student-user-test-001', email: 'amara@skillsync.test', role: 'STUDENT', emailVerified: true,
  }));
  let applicationLookupCalled = false;
  mockMethod(t, prisma.application, 'findUnique', async () => {
    applicationLookupCalled = true;
    return null;
  });

  const { response } = await applicationLifecycleRequest('close', 'application-test-001', 'STUDENT');
  assert.equal(response.status, 403);
  assert.equal(applicationLookupCalled, false);
});

test('there is no employer application delete endpoint', async (t) => {
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER', emailVerified: true,
  }));
  const token = signToken({
    userId: 'employer-user-test-001',
    email: 'employer@skillsync.test',
    role: 'EMPLOYER',
  });
  const response = await fetch(`${baseUrl}/employer/applications/application-test-001`, {
    method: 'DELETE',
    headers: { Authorization: ['Bearer', token].join(' ') },
  });
  assert.equal(response.status, 404);
});