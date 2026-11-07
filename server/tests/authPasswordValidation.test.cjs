process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'password-validation-test-secret-that-is-long-enough';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const authRoutes = require('../dist/routes/auth').default;
const { errorHandler } = require('../dist/middleware/errorHandler');

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

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('student and employer registration reject weak passwords with safe validation errors', async () => {
  for (const role of ['STUDENT', 'EMPLOYER']) {
    for (const password of invalidPasswords) {
      const requestBody = {
        email: `${role.toLowerCase()}@example.test`,
        password,
        firstName: 'Amara',
        lastName: 'Ndlovu',
        role,
        ...(role === 'STUDENT'
          ? { university: 'University of Cape Town' }
          : { companyName: 'Cape Digital Labs' }),
      };
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();

      assert.equal(response.status, 400, `${role} password: ${password}`);
      if (password) {
        assert.equal(responseText.includes(password), false, `${role} response echoed its password`);
      }
      assert.match(responseText, /at least 12 characters|12 characters|special character/);
    }
  }
});

test('password reset applies the same complexity policy before token lookup', async () => {
  const password = 'Password1234';
  const response = await fetch(`${baseUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(64), password }),
  });
  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.equal(responseText.includes(password), false);
  assert.match(responseText, /special character/);
});
