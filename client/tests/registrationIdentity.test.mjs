import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeRegistrationIdentityFields } from '../src/utils/registrationIdentity.mjs';

test('trims valid international names and university values', () => {
  assert.deepEqual(
    normalizeRegistrationIdentityFields({
      firstName: '  José Anne-Marie  ',
      lastName: " O'Connor 李 ",
      university: '  École 42 — Paris  ',
    }),
    {
      firstName: 'José Anne-Marie',
      lastName: "O'Connor 李",
      university: 'École 42 — Paris',
    },
  );
});

test('omits an optional university when it is not provided', () => {
  assert.deepEqual(
    normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu' }),
    { firstName: 'Amara', lastName: 'Ndlovu' },
  );
  assert.deepEqual(
    normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu', university: '' }),
    { firstName: 'Amara', lastName: 'Ndlovu' },
  );
});

test('rejects names without letters, blank names, and overlong names', () => {
  for (const firstName of ['123', '!!!', '', '   ', 'a'.repeat(81)]) {
    assert.throws(
      () => normalizeRegistrationIdentityFields({ firstName, lastName: 'Ndlovu' }),
      /First name/i,
    );
  }
});

test('rejects blank, punctuation-only, and overlong supplied universities', () => {
  for (const university of ['   ', '---...', 'U'.repeat(161)]) {
    assert.throws(
      () => normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu', university }),
      /University/i,
    );
  }
});
