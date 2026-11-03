import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
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

test('accepts a password of exactly 12 characters', () => {
  assert.equal(getPasswordValidationError('Abcdefghij1!'), null);
});

test('accepts a password of exactly 72 ASCII characters', () => {
  const password = 'A'.repeat(72);
  assert.equal(getPasswordValidationError(password), null);
});

test('rejects a password longer than 72 characters', () => {
  assert.equal(getPasswordValidationError('A'.repeat(73)), 'Password must be no more than 72 characters.');
});

test('rejects passwords within the character limit that exceed the UTF-8 byte limit', () => {
  assert.equal(getPasswordValidationError('😀'.repeat(19)), 'Password must not exceed 72 UTF-8 bytes.');
});

test('password strength only awards its length point when backend policy is satisfied', () => {
  assert.equal(getPasswordStrengthScore('Abcdef1!xy'), 0);
  assert.equal(getPasswordStrengthScore('Abcdefghij1!'), 4);
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
  assert.equal(PASSWORD_MIN_LENGTH, 12);
  assert.equal(PASSWORD_MAX_LENGTH, 72);
  assert.match(PASSWORD_POLICY_GUIDANCE, /12 to 72 characters/);
  assert.match(PASSWORD_POLICY_GUIDANCE, /72 UTF-8 bytes/);
});