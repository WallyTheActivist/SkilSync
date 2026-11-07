import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getPasswordRequirements,
  getPasswordStrengthScore,
  getPasswordValidationError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_GUIDANCE,
  passwordsMatch,
} from '../src/utils/passwordPolicy.mjs';

test('rejects a password shorter than 12 characters', () => {
  assert.equal(getPasswordValidationError('Abcdef1!xyz'), 'Password must be at least 12 characters.');
});

test('rejects passwords that fail any required complexity rule', () => {
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
  ];

  for (const password of invalidPasswords) {
    assert.notEqual(getPasswordValidationError(password), null, password);
  }
});

test('accepts a password of exactly 12 characters', () => {
  assert.equal(getPasswordValidationError('Password123!'), null);
});

test('accepts longer passwords, including valid passwords containing spaces', () => {
  assert.equal(getPasswordValidationError('Valid Password123!'), null);
  assert.equal(getPasswordValidationError('Good Pass123!'), null);
});

test('spaces do not count as a special character', () => {
  assert.equal(getPasswordValidationError('Password 1234')?.includes('special character'), true);
});

test('password requirement indicators report each condition independently', () => {
  assert.deepEqual(
    getPasswordRequirements('Password123!').map(({ id, met }) => [id, met]),
    [
      ['length', true],
      ['uppercase', true],
      ['lowercase', true],
      ['number', true],
      ['special', true],
    ],
  );
  assert.deepEqual(
    getPasswordRequirements('').map(({ met }) => met),
    [false, false, false, false, false],
  );
});

test('accepts a password of exactly 72 ASCII characters', () => {
  const password = 'ValidPassword123!'.padEnd(72, 'x');
  assert.equal(getPasswordValidationError(password), null);
});

test('rejects a password longer than 72 characters', () => {
  assert.equal(getPasswordValidationError('ValidPassword123!'.padEnd(73, 'x')), 'Password must be no more than 72 characters.');
});

test('rejects passwords within the character limit that exceed the UTF-8 byte limit', () => {
  assert.equal(getPasswordValidationError('😀'.repeat(19)), 'Password must not exceed 72 UTF-8 bytes.');
});

test('password strength is only awarded when the policy is satisfied', () => {
  assert.equal(getPasswordStrengthScore('Abcdef1!xy'), 0);
  assert.equal(getPasswordStrengthScore('Password123!'), 4);
});

test('confirmation requires an exact password match', () => {
  assert.equal(passwordsMatch('Abcdefghij1!', 'Abcdefghij1!'), true);
  assert.equal(passwordsMatch('Abcdefghij1!', 'Abcdefghij1?'), false);
});

test('registration and reset forms share the same policy guidance, limits, and confirmation check', async () => {
  const [register, reset] = await Promise.all([
    readFile(new URL('../src/pages/auth/Register.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/auth/ResetPassword.tsx', import.meta.url), 'utf8'),
  ]);

  for (const source of [register, reset]) {
    assert.match(source, /PASSWORD_POLICY_GUIDANCE/);
    assert.match(source, /\{PASSWORD_POLICY_GUIDANCE\}/);
    assert.match(source, /minLength=\{PASSWORD_MIN_LENGTH\}/);
    assert.match(source, /maxLength=\{PASSWORD_MAX_LENGTH\}/);
    assert.match(source, /getPasswordValidationError\(/);
    assert.match(source, /passwordsMatch\(/);
  }
  assert.match(register, /getPasswordRequirements\(form\.password\)/);
  assert.match(register, /Password requirements:/);
  assert.equal(PASSWORD_MIN_LENGTH, 12);
  assert.equal(PASSWORD_MAX_LENGTH, 72);
  assert.match(PASSWORD_POLICY_GUIDANCE, /12 to 72 characters/);
  assert.match(PASSWORD_POLICY_GUIDANCE, /72 UTF-8 bytes/);
});