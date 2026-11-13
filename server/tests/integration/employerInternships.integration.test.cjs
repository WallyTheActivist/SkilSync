const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'employer-internship-test-secret-that-is-long-enough';

const prisma = require('../../dist/config/database').default;
const employerRouter = require('../../dist/routes/employer').default;
const { signToken } = require('../../dist/utils/jwt');
const { errorHandler } = require('../../dist/middleware/errorHandler');

const app = express();
app.use(express.json());
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

const updateInternship = (body, internshipId = 'internship-test-001') => {
  const token = signToken({ userId: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER' });
  return fetch(`${baseUrl}/employer/internships/${internshipId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (response) => ({ response, body: await response.json() }));
};

const getInternship = (internshipId = 'internship-test-001') => {
  const token = signToken({ userId: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER' });
  return fetch(`${baseUrl}/employer/internships/${internshipId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => ({ response, body: await response.json() }));
};

const getInternshipListing = (query = '') => {
  const token = signToken({ userId: 'employer-user-test-001', email: 'employer@skillsync.test', role: 'EMPLOYER' });
  return fetch(`${baseUrl}/employer/internships${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => ({ response, body: await response.json() }));
};

const setupInternship = (testContext, { owned = true, failCreateMany = false, internshipId = 'internship-test-001' } = {}) => {
  let state = {
    internship: {
      id: internshipId,
      employerProfileId: 'employer-profile-test-001',
      title: 'Original title',
    },
    requirements: [
      { internshipId, skillId: 'java', importance: 3, minimumLevel: 'BEGINNER' },
      { internshipId, skillId: 'sql', importance: 3, minimumLevel: 'BEGINNER' },
    ],
  };
  let transactionCalls = 0;
  let lastLookup;

  mockMethod(testContext, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001',
    email: 'employer@skillsync.test',
    role: 'EMPLOYER',
    emailVerified: true,
  }));
  mockMethod(testContext, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(testContext, prisma.skill, 'findMany', async ({ where }) => (
    where.id.in
      .filter((id) => ['java', 'sql', 'python', 'react', 'typescript'].includes(id))
      .map((id) => ({ id }))
  ));
  mockMethod(testContext, prisma.internship, 'findFirst', async ({ where }) => {
    lastLookup = { ...where };
    assert.equal(where.employerProfileId, 'employer-profile-test-001');
    return owned && where.id === state.internship.id ? {
      ...state.internship,
      requiredSkills: state.requirements.map((requirement) => ({
        ...requirement,
        skill: { id: requirement.skillId, name: requirement.skillId },
      })),
      _count: { applications: 0 },
    } : null;
  });
  mockMethod(testContext, prisma, '$transaction', async (callback) => {
    transactionCalls += 1;
    const draft = structuredClone(state);
    const transaction = {
      internship: {
        update: async ({ where, data }) => {
          assert.equal(where.id, draft.internship.id);
          draft.internship = { ...draft.internship, ...data };
          return draft.internship;
        },
        findUnique: async ({ where }) => {
          assert.equal(where.id, draft.internship.id);
          return {
            ...draft.internship,
            requiredSkills: draft.requirements.map((requirement) => ({
              ...requirement,
              skill: { id: requirement.skillId, name: requirement.skillId },
            })),
            _count: { applications: 0 },
          };
        },
      },
      internshipSkill: {
        deleteMany: async ({ where }) => {
          assert.equal(where.internshipId, draft.internship.id);
          draft.requirements = [];
        },
        createMany: async ({ data }) => {
          if (failCreateMany) throw new Error('deterministic requirement insert failure');
          draft.requirements.push(...data);
          return { count: data.length };
        },
      },
    };

    const result = await callback(transaction);
    state = draft;
    return result;
  });

  return {
    getState: () => state,
    getTransactionCalls: () => transactionCalls,
    getLastLookup: () => lastLookup,
  };
};

test('employer can load and update an internship on the first listing page by ID', async (t) => {
  const fixture = setupInternship(t);
  const loaded = await getInternship();
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.body.data.id, 'internship-test-001');
  assert.deepEqual(fixture.getLastLookup(), {
    id: 'internship-test-001',
    employerProfileId: 'employer-profile-test-001',
  });

  const updated = await updateInternship({ title: 'First-page update' });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.title, 'First-page update');
});

test('employer can load and update an internship beyond the first listing page by ID', async (t) => {
  const targetId = 'internship-test-011';
  const fixture = setupInternship(t, { internshipId: targetId });
  const records = Array.from({ length: 11 }, (_, index) => ({
    id: `internship-test-${String(index + 1).padStart(3, '0')}`,
    employerProfileId: 'employer-profile-test-001',
  }));
  let listingQuery;
  mockMethod(t, prisma.internship, 'findMany', async (args) => {
    listingQuery = args;
    return records.slice(args.skip, args.skip + args.take);
  });
  mockMethod(t, prisma.internship, 'count', async () => records.length);

  const firstPage = await getInternshipListing('?page=1&limit=10');
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.body.data.length, 10);
  assert.equal(firstPage.body.data.some(({ id }) => id === targetId), false);
  assert.equal(listingQuery.skip, 0);
  assert.equal(listingQuery.take, 10);

  const loaded = await getInternship(targetId);
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.body.data.id, targetId);
  assert.deepEqual(fixture.getLastLookup(), {
    id: targetId,
    employerProfileId: 'employer-profile-test-001',
  });

  const updated = await updateInternship({ title: 'Beyond-page update' }, targetId);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.title, 'Beyond-page update');
});

test('employer internship listing still honors requested pagination', async (t) => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    id: `internship-test-${String(index + 1).padStart(3, '0')}`,
    employerProfileId: 'employer-profile-test-001',
  }));
  let listingQuery;
  mockMethod(t, prisma.user, 'findUnique', async () => ({
    id: 'employer-user-test-001',
    email: 'employer@skillsync.test',
    role: 'EMPLOYER',
    emailVerified: true,
  }));
  mockMethod(t, prisma.employerProfile, 'findUnique', async () => ({ id: 'employer-profile-test-001' }));
  mockMethod(t, prisma.internship, 'findMany', async (args) => {
    listingQuery = args;
    return records.slice(args.skip, args.skip + args.take);
  });
  mockMethod(t, prisma.internship, 'count', async () => records.length);

  const { response, body } = await getInternshipListing('?page=2&limit=5');
  assert.equal(response.status, 200);
  assert.equal(body.data.length, 5);
  assert.deepEqual(listingQuery.where, { employerProfileId: 'employer-profile-test-001' });
  assert.equal(listingQuery.skip, 5);
  assert.equal(listingQuery.take, 5);
  assert.deepEqual(body.pagination, { total: 12, page: 2, limit: 5, pages: 3 });
});

test('employer can replace existing requirements with new requirements', async (t) => {
  const fixture = setupInternship(t);
  const { response, body } = await updateInternship({
    title: 'Updated title',
    skills: [
      { skillId: 'python', importance: 5, minimumLevel: 'ADVANCED' },
      { skillId: 'react', importance: 4, minimumLevel: 'INTERMEDIATE' },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.title, 'Updated title');
  assert.deepEqual(body.data.requiredSkills.map(({ skillId }) => skillId), ['python', 'react']);
  assert.deepEqual(fixture.getState().requirements.map(({ skillId }) => skillId), ['python', 'react']);
  assert.equal(fixture.getTransactionCalls(), 1);
});

test('employer can update multiple requirements in one operation', async (t) => {
  const fixture = setupInternship(t);
  const { response, body } = await updateInternship({
    skills: [
      { skillId: 'python', importance: 5, minimumLevel: 'ADVANCED' },
      { skillId: 'react', importance: 4, minimumLevel: 'INTERMEDIATE' },
      { skillId: 'typescript', importance: 3, minimumLevel: 'BEGINNER' },
    ],
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body.data.requiredSkills.map(({ skillId }) => skillId), ['python', 'react', 'typescript']);
  assert.deepEqual(fixture.getState().requirements.map(({ skillId }) => skillId), ['python', 'react', 'typescript']);
});

test('employer requirement updates reject missing, empty, and non-string skill IDs', async (t) => {
  const emptySkillsFixture = setupInternship(t);
  const emptySkills = await updateInternship({ title: 'Must not update', skills: [] });
  assert.equal(emptySkills.response.status, 400);
  assert.match(emptySkills.body.errors.join(' '), /skills must contain between 1 and 50 items/i);
  assert.equal(emptySkillsFixture.getTransactionCalls(), 0);
  assert.equal(emptySkillsFixture.getState().internship.title, 'Original title');
  assert.deepEqual(emptySkillsFixture.getState().requirements.map(({ skillId }) => skillId), ['java', 'sql']);

  const invalidRequirements = [
    ['missing skillId', [{ importance: 3, minimumLevel: 'BEGINNER' }]],
    ['empty skillId', [{ skillId: ' ', importance: 3, minimumLevel: 'BEGINNER' }]],
    ['non-string skillId', [{ skillId: 42, importance: 3, minimumLevel: 'BEGINNER' }]],
    ['unknown skill ID', [{ skillId: 'missing-skill', importance: 3, minimumLevel: 'BEGINNER' }]],
    ['duplicate skillId', [
      { skillId: 'python', importance: 3, minimumLevel: 'BEGINNER' },
      { skillId: 'python', importance: 4, minimumLevel: 'INTERMEDIATE' },
    ]],
  ];

  for (const [description, skills] of invalidRequirements) {
    await t.test(description, async (subtest) => {
      const fixture = setupInternship(subtest);
      const { response, body } = await updateInternship({ skills });

      assert.equal(response.status, 400);
      if (description === 'unknown skill ID') {
        assert.match(body.message, /required skills do not exist/i);
      } else {
        assert.ok(body.errors.length > 0);
      }
      assert.equal(fixture.getTransactionCalls(), 0);
      assert.deepEqual(fixture.getState().requirements.map(({ skillId }) => skillId), ['java', 'sql']);
    });
  }
});

test('failed requirement insertion rolls back internship fields and existing requirements', async (t) => {
  const fixture = setupInternship(t, { failCreateMany: true });
  const { response } = await updateInternship({
    title: 'Should roll back',
    skills: [{ skillId: 'python', importance: 5, minimumLevel: 'ADVANCED' }],
  });

  assert.equal(response.status, 500);
  assert.equal(fixture.getState().internship.title, 'Original title');
  assert.deepEqual(fixture.getState().requirements.map(({ skillId }) => skillId), ['java', 'sql']);
  assert.equal(fixture.getTransactionCalls(), 1);
});

test('employer cannot update an internship owned by another profile', async (t) => {
  const fixture = setupInternship(t, { owned: false });
  const loaded = await getInternship();
  assert.equal(loaded.response.status, 404);
  assert.match(loaded.body.message, /internship not found/i);

  const { response } = await updateInternship({
    skills: [{ skillId: 'python', importance: 3, minimumLevel: 'BEGINNER' }],
  });

  assert.equal(response.status, 404);
  assert.deepEqual(fixture.getState().requirements.map(({ skillId }) => skillId), ['java', 'sql']);
  assert.equal(fixture.getTransactionCalls(), 0);
});

test('non-existent internship IDs return the existing not-found response', async (t) => {
  const fixture = setupInternship(t);
  const loaded = await getInternship('missing-internship-id');
  assert.equal(loaded.response.status, 404);
  assert.match(loaded.body.message, /internship not found/i);

  const updated = await updateInternship({ title: 'Must not update' }, 'missing-internship-id');
  assert.equal(updated.response.status, 404);
  assert.match(updated.body.message, /internship not found/i);
  assert.equal(fixture.getTransactionCalls(), 0);
  assert.equal(fixture.getState().internship.title, 'Original title');
});