const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  EmailDeliveryConfigurationError,
  getEmailVerificationConfig,
} = require('../dist/services/emailVerificationService');

const config = (overrides = {}) => getEmailVerificationConfig({
  NODE_ENV: 'test',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'SkillSync <no-reply@example.test>',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-test-secret',
  FRONTEND_URL: 'http://localhost:5173',
  ...overrides,
});

test('production requires HTTPS frontend URLs', () => {
  assert.throws(
    () => config({ NODE_ENV: 'production', FRONTEND_URL: 'http://skillsync.example' }),
    (error) => error instanceof EmailDeliveryConfigurationError
      && /FRONTEND_URL must use HTTPS in production/i.test(error.message),
  );
});

test('production accepts HTTPS frontend URLs and requires STARTTLS when implicit TLS is off', () => {
  const productionConfig = config({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://skillsync.example',
    SMTP_SECURE: 'false',
  });

  assert.equal(productionConfig.frontendUrl, 'https://skillsync.example/');
  assert.equal(productionConfig.requireTLS, true);
  assert.equal(productionConfig.rejectUnauthorized, true);
});

test('production permits implicit TLS and still validates SMTP certificates', () => {
  const productionConfig = config({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://skillsync.example',
    SMTP_SECURE: 'true',
  });

  assert.equal(productionConfig.secure, true);
  assert.equal(productionConfig.requireTLS, false);
  assert.equal(productionConfig.rejectUnauthorized, true);
});

test('development permits localhost HTTP without weakening certificate validation', () => {
  const developmentConfig = config({
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:5173',
  });

  assert.equal(developmentConfig.frontendUrl, 'http://localhost:5173/');
  assert.equal(developmentConfig.requireTLS, false);
  assert.equal(developmentConfig.rejectUnauthorized, true);
});

test('SMTP security configuration errors do not reveal credentials', () => {
  const secret = 'never-include-this-smtp-secret';

  assert.throws(
    () => config({ NODE_ENV: 'production', SMTP_SECURE: 'sometimes', SMTP_PASS: secret }),
    (error) => error instanceof EmailDeliveryConfigurationError
      && !error.message.includes(secret),
  );
});
