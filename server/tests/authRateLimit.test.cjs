const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

const {
  createApiRateLimiter,
  createAuthRateLimiter,
  getAuthRateLimitSettings,
} = require('../dist/config/authRateLimit');

test('default, test, and production settings retain the 20-request, 15-minute IP rate limit', () => {
  assert.deepEqual(getAuthRateLimitSettings({}), {
    enabled: true,
    windowMs: 15 * 60 * 1000,
    max: 20,
  });
  assert.equal(getAuthRateLimitSettings({ NODE_ENV: 'test' }).enabled, true);
  assert.equal(getAuthRateLimitSettings({ NODE_ENV: 'production' }).enabled, true);
});

test('development settings disable only the authentication-specific limiter', () => {
  assert.deepEqual(getAuthRateLimitSettings({ NODE_ENV: 'development' }), {
    enabled: false,
    windowMs: 15 * 60 * 1000,
    max: 20,
  });
});

test('production limiter shares an IP-based window across login, registration, and password reset', async (t) => {
  const app = express();
  const productionSettings = getAuthRateLimitSettings({});
  app.use('/auth', createAuthRateLimiter({ ...productionSettings, max: 2, windowMs: 60_000 }));
  app.post('/auth/login', (_req, res) => res.status(401).json({ success: false }));
  app.post('/auth/register', (_req, res) => res.status(400).json({ success: false }));
  app.post('/auth/forgot-password', (_req, res) => res.sendStatus(200));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const loginResponse = await fetch(`${baseUrl}/auth/login`, { method: 'POST' });
  const registerResponse = await fetch(`${baseUrl}/auth/register`, { method: 'POST' });
  const blockedResponse = await fetch(`${baseUrl}/auth/forgot-password`, { method: 'POST' });

  assert.equal(loginResponse.status, 401);
  assert.equal(registerResponse.status, 400);
  assert.equal(blockedResponse.status, 429);
  assert.match((await blockedResponse.json()).message, /Too many login attempts/);
});

test('development limiter permits repeated requests to both authentication routes', async (t) => {
  const app = express();
  app.use('/auth', createAuthRateLimiter(getAuthRateLimitSettings({ NODE_ENV: 'development' })));
  app.post('/auth/login', (_req, res) => res.sendStatus(401));
  app.post('/auth/register', (_req, res) => res.sendStatus(400));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { method: 'POST' });
    const registerResponse = await fetch(`${baseUrl}/auth/register`, { method: 'POST' });
    assert.equal(loginResponse.status, 401);
    assert.equal(registerResponse.status, 400);
  }
});

test('development login is exempt from the general API limit while other API routes remain limited', async (t) => {
  const app = express();
  const developmentSettings = getAuthRateLimitSettings({ NODE_ENV: 'development' });
  app.use('/api', createApiRateLimiter(developmentSettings, { max: 2, windowMs: 60_000 }));
  app.post('/api/auth/login', (_req, res) => res.sendStatus(401));
  app.get('/api/student/profile', (_req, res) => res.sendStatus(200));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' });
    assert.equal(loginResponse.status, 401);
  }

  assert.equal((await fetch(`${baseUrl}/api/student/profile`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/student/profile`)).status, 200);
  const limitedApiResponse = await fetch(`${baseUrl}/api/student/profile`);
  assert.equal(limitedApiResponse.status, 429);
});
