import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeStudentProfileUpdate } from '../src/utils/studentProfileUpdate.mjs';

test('serializes valid numeric profile values as JSON numbers', () => {
  assert.deepEqual(
    normalizeStudentProfileUpdate({ yearOfStudy: '3', gpa: '3.5', city: 'Cape Town' }),
    { yearOfStudy: 3, gpa: 3.5, city: 'Cape Town' },
  );
});

test('serializes blank optional numeric fields as null for clearing', () => {
  assert.deepEqual(
    normalizeStudentProfileUpdate({ yearOfStudy: '', gpa: '   ' }),
    { yearOfStudy: null, gpa: null },
  );
});

test('rejects malformed numeric values instead of coercing them', () => {
  assert.throws(() => normalizeStudentProfileUpdate({ yearOfStudy: 'third' }), /valid number/i);
  assert.throws(() => normalizeStudentProfileUpdate({ gpa: 'Infinity' }), /valid number/i);
  assert.throws(() => normalizeStudentProfileUpdate({ gpa: '1e-999' }), /valid number/i);
});

test('trims and validates profile names using registration identity rules', () => {
  assert.deepEqual(
    normalizeStudentProfileUpdate({ firstName: ' Zoë ', lastName: " D'Arcy " }),
    { firstName: 'Zoë', lastName: "D'Arcy" },
  );
  assert.throws(() => normalizeStudentProfileUpdate({ firstName: '123' }), /First name/i);
});
