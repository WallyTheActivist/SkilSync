const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getPasswordValidationError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} = require('../../dist/utils/passwordPolicy');

test('rejects passwords that fail any required complexity rule', () => {
  const invalidPasswords = [
    '',
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
  ];

  for (const password of invalidPasswords) {
    assert.notEqual(getPasswordValidationError(password), null, password);
  }
});

test('accepts an exactly 12-character password and longer passwords with spaces', () => {
  assert.equal(getPasswordValidationError('Password123!'), null);
  assert.equal(getPasswordValidationError('Good Pass123!'), null);
});

test('preserves character and bcrypt byte limits', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 12);
  assert.equal(PASSWORD_MAX_LENGTH, 72);
  assert.equal(getPasswordValidationError('ValidPassword123!'.padEnd(72, 'x')), null);
  assert.match(getPasswordValidationError('ValidPassword123!'.padEnd(73, 'x')), /72 characters/);
  assert.match(getPasswordValidationError(`Aa1!${'é'.repeat(35)}`), /72 UTF-8 bytes/);
});
