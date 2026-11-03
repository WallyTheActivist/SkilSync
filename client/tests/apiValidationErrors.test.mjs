import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getApiValidationFieldErrors } from '../src/utils/apiValidationErrors.mjs';

test('maps safe structured HTTP 400 errors to known fields only', () => {
  const error = {
    response: {
      status: 400,
      data: { errors: ['gpa must be a number between 0 and 100.', 'Unknown validation detail.'] },
    },
  };
  assert.deepEqual(getApiValidationFieldErrors(error, ['gpa', 'yearOfStudy']), {
    gpa: 'gpa must be a number between 0 and 100.',
  });
});

test('does not expose non-validation, internal, or unrecognized errors', () => {
  assert.deepEqual(
    getApiValidationFieldErrors({
      response: { status: 500, data: { errors: ['title failed in database SQL stack'] } },
    }, ['title']),
    {},
  );
  assert.deepEqual(
    getApiValidationFieldErrors({
      response: { status: 400, data: { errors: ['SQL database stack for title'] } },
    }, ['title']),
    {},
  );
});

test('maps dotted validation parameters to their known parent field', () => {
  assert.deepEqual(
    getApiValidationFieldErrors({
      response: { status: 400, data: { errors: ['skills.0.skillId must be a valid skillId.'] } },
    }, ['skills', 'skillId']),
    { skillId: 'skills.0.skillId must be a valid skillId.' },
  );
});
