import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBackupValidationLabel } from '../src/utils/backupValidation.mjs';

test('creation failure takes precedence over an earlier passed validation', () => {
  assert.equal(getBackupValidationLabel({
    creationResult: 'failed',
    validationStatus: 'passed',
    sha256: 'a'.repeat(64),
  }), 'Failed');
});

test('passed validation requires a well-formed SHA-256 digest', () => {
  assert.equal(getBackupValidationLabel({
    creationResult: 'succeeded',
    validationStatus: 'passed',
    sha256: 'a'.repeat(64),
  }), 'Passed');
  assert.equal(getBackupValidationLabel({
    creationResult: 'succeeded',
    validationStatus: 'passed',
    sha256: null,
  }), 'Not verified');
  assert.equal(getBackupValidationLabel({
    creationResult: 'succeeded',
    validationStatus: 'passed',
    sha256: 'missing-or-malformed',
  }), 'Not verified');
});

test('failed and unknown validation statuses remain distinct', () => {
  assert.equal(getBackupValidationLabel({
    creationResult: 'succeeded',
    validationStatus: 'failed',
    sha256: 'a'.repeat(64),
  }), 'Failed');
  assert.equal(getBackupValidationLabel({
    creationResult: 'succeeded',
    validationStatus: 'unknown',
    sha256: 'a'.repeat(64),
  }), 'Not verified');
});
