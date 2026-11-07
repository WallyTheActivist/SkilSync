import assert from 'node:assert/strict';
import test from 'node:test';
import { loadInternshipDetail } from '../src/utils/internshipDetailLoader.mjs';

const internship = {
  id: 'internship-123',
  title: 'DevOps Engineer Intern',
  description: 'Build deployment pipelines.',
};

test('loads the internship and requests its match score with the same selected ID', async () => {
  const requestedIds = [];
  const loaded = await loadInternshipDetail('internship-123', {
    getById: async (id) => {
      requestedIds.push(id);
      return { data: { data: internship } };
    },
    getMatchScore: async (id) => {
      requestedIds.push(id);
      return { data: { data: { overall: 80 } } };
    },
  });

  assert.deepEqual(requestedIds, ['internship-123', 'internship-123']);
  assert.equal(loaded.internship, internship);
  assert.deepEqual(loaded.matchScore, { overall: 80 });
  assert.equal(loaded.matchScoreFailed, false);
});

test('keeps internship details available when the protected match score request fails', async () => {
  const loaded = await loadInternshipDetail('internship-123', {
    getById: async () => ({ data: { data: internship } }),
    getMatchScore: async () => {
      throw { response: { status: 403 } };
    },
  });

  assert.equal(loaded.internship.title, 'DevOps Engineer Intern');
  assert.equal(loaded.matchScore, null);
  assert.equal(loaded.matchScoreFailed, true);
});

test('propagates a failed internship lookup so the page can show its not-found error', async () => {
  const notFound = { response: { status: 404 } };
  await assert.rejects(
    loadInternshipDetail('missing-internship', {
      getById: async () => { throw notFound; },
      getMatchScore: async () => ({ data: { data: { overall: 80 } } }),
    }),
    (error) => error === notFound,
  );
});
