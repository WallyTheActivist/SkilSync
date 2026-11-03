import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isAuthenticationRequest } from '../src/utils/authRequest.js';

test('identifies authentication endpoint paths that must not trigger the global 401 redirect', () => {
  for (const url of [
    '/auth/login',
    '/auth/register',
    '/auth/me',
    '/auth/forgot-password',
    '/api/auth/login',
    'http://localhost:5000/api/auth/me',
  ]) {
    assert.equal(isAuthenticationRequest(url), true, url);
  }
});

test('does not exempt protected API requests from the global 401 redirect', () => {
  for (const url of [
    '/student/profile',
    '/api/student/profile',
    'http://localhost:5000/api/admin/users',
  ]) {
    assert.equal(isAuthenticationRequest(url), false, url);
  }
  assert.equal(isAuthenticationRequest(undefined), false);
});

test('Axios only forces login navigation for non-authentication 401 responses', async () => {
  const apiSource = await readFile(new URL('../src/services/api.ts', import.meta.url), 'utf8');
  assert.match(
    apiSource,
    /err\.response\?\.status === 401 && !isAuthenticationRequest\(err\.config\?\.url\)/
  );
});
