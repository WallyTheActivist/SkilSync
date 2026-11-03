import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEmployerProfileUpdate } from '../src/utils/employerProfileUpdate.mjs';

test('serializes a blank optional company website as null for clearing', () => {
  assert.deepEqual(
    normalizeEmployerProfileUpdate({
      companyName: 'Example Company',
      industry: '',
      website: '   ',
      description: '',
      city: '',
      country: 'South Africa',
    }),
    {
      companyName: 'Example Company',
      industry: '',
      website: null,
      description: '',
      city: '',
      country: 'South Africa',
    },
  );
});

test('preserves valid company website values', () => {
  assert.equal(
    normalizeEmployerProfileUpdate({
      companyName: 'Example Company',
      industry: '',
      website: 'https://example.test',
      description: '',
      city: '',
      country: 'South Africa',
    }).website,
    'https://example.test',
  );
});
