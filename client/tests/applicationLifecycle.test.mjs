import test from 'node:test';
import assert from 'node:assert/strict';
import { isApplicationClosed } from '../src/utils/applicationLifecycle.mjs';

test('an application is open when it has no closure timestamp', () => {
  assert.equal(isApplicationClosed(null), false);
  assert.equal(isApplicationClosed(undefined), false);
});

test('an application is closed when it has a closure timestamp', () => {
  assert.equal(isApplicationClosed('2026-11-08T18:00:00.000Z'), true);
});
