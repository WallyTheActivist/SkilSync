const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const net = require('node:net');

const testDatabaseUrl = process.env.SKILLSYNC_TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  test('registration persistence requires SKILLSYNC_TEST_DATABASE_URL', { skip: true }, () => {});
} else {
  if (!/^file:.*test/i.test(testDatabaseUrl)) {
    throw new Error('SKILLSYNC_TEST_DATABASE_URL must be an isolated SQLite URL containing "test" in its path.');
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'registration-integration-test-secret-that-is-long-enough';

  const prisma = require('../../dist/config/database').default;
  const { createAuthRateLimiter } = require('../../dist/config/authRateLimit');
  const authRoutes = require('../../dist/routes/auth').default;
  const employerRoutes = require('../../dist/routes/employer').default;
  const { errorHandler } = require('../../dist/middleware/errorHandler');
  const { verifyPassword } = require('../../dist/utils/password');
  const { signToken } = require('../../dist/utils/jwt');

  const suffix = `${process.pid}-${Date.now()}`;
  const createdEmails = [];
  const smtpMessages = [];
  let smtpConnectionCount = 0;
  const smtpServer = net.createServer((socket) => {
    smtpConnectionCount += 1;
    socket.setEncoding('utf8');
    socket.write('220 skillsync test smtp\r\n');
    let input = '';
    let message = '';
    let inData = false;
    socket.on('data', (chunk) => {
      input += chunk;
      let newline;
      while ((newline = input.indexOf('\n')) !== -1) {
        const line = input.slice(0, newline).replace(/\r$/, '');
        input = input.slice(newline + 1);
        if (inData) {
          if (line === '.') {
            inData = false;
            smtpMessages.push(message);
            message = '';
            socket.write('250 Message accepted\r\n');
          } else {
            message += `${line}\r\n`;
          }
        } else if (/^(EHLO|HELO)\b/i.test(line)) {
          socket.write('250-localhost\r\n250 SIZE 10485760\r\n');
        } else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)\b/i.test(line)) {
          socket.write('250 OK\r\n');
        } else if (/^DATA\b/i.test(line)) {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT\b/i.test(line)) {
          socket.write('221 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
    socket.on('error', () => {});
  });
  let server;
  let baseUrl;

  const register = async (fields, extraHeaders = {}) => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(fields),
    });
    return { response, body: await response.json() };
  };

  const baseRegistration = (email, fields = {}) => ({
    email,
    password: 'Synthetic-Registration-Pass-2026!',
    firstName: 'Amara',
    lastName: 'Ndlovu',
    ...fields,
  });

  const verificationTokenFromLatestEmail = () => {
    const message = smtpMessages.at(-1);
    assert.ok(message, 'verification email was delivered');
    const decodedMessage = message.replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
    const match = decodedMessage.match(/\/verify-email\?token=([a-f\d]{64})/i);
    assert.ok(match, 'verification link contains the raw token');
    return match[1];
  };

  before(async () => {
    await new Promise((resolve) => smtpServer.listen(0, '127.0.0.1', resolve));
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(smtpServer.address().port);
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.SMTP_FROM = 'SkillSync Tests <no-reply@skillsync.test>';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.EMAIL_VERIFICATION_TTL_HOURS = '24';
    await prisma.$connect();
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use('/rate-limited-auth', createAuthRateLimiter({
      enabled: true,
      windowMs: 15 * 60 * 1000,
      max: 2,
    }), authRoutes);
    app.use('/employer', employerRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await new Promise((resolve, reject) => smtpServer.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  });

  test('registration validates identity data and persists normalized accounts', async (t) => {
    const invalidCases = [
      ['digit-first-name', { firstName: '123' }],
      ['digit-last-name', { lastName: '333' }],
      ['one-letter-first-name', { firstName: 'A' }],
      ['one-letter-last-name', { lastName: 'B' }],
      ['blank-first-name', { firstName: '   ' }],
      ['blank-last-name', { lastName: '\t\n' }],
      ['punctuation-name', { firstName: '!!!' }],
      ['special-character-name', { firstName: 'Jo.Smith' }],
      ['employer-digit-name', { firstName: '123', role: 'EMPLOYER' }],
      ['long-name', { lastName: 'N'.repeat(81) }],
      ['single-character-main-domain', { email: `nathan.${suffix}@g.com` }],
      ['missing-at-symbol', { email: `nathan.${suffix}gmail.com` }],
      ['multiple-at-symbols', { email: `nathan@@${suffix}@gmail.com` }],
      ['missing-extension', { email: `nathan.${suffix}@gmail` }],
      ['email-whitespace', { email: `nathan ${suffix}@gmail.com` }],
      ['consecutive-local-dots', { email: `nathan..${suffix}@gmail.com` }],
      ['empty-domain-label', { email: `nathan.${suffix}@gmail..com` }],
      ['leading-empty-domain-label', { email: `nathan.${suffix}@.gmail.com` }],
      ['missing-local-part', { email: `@gmail.com` }],
      ['blank-university', { university: '   ' }],
      ['punctuation-university', { university: '---...' }],
      ['long-university', { university: 'U'.repeat(161) }],
    ];

    for (const [label, fields] of invalidCases) {
      const email = `${label}.${suffix}@skillsync.test`;
      const { response } = await register(baseRegistration(email, fields));
      assert.equal(response.status, 400, label);
      assert.equal(await prisma.user.count({ where: { email } }), 0, label);
    }

    const email = `jose.${suffix}@skillsync.test`;
    createdEmails.push(email.toLowerCase());
    const { response, body } = await register(baseRegistration(email.toUpperCase(), {
      firstName: '  José Anne-Marie  ',
      lastName: " O'Connor 李 ",
      university: '  École 42 — Paris  ',
    }));
    assert.equal(response.status, 201);
    assert.equal(body.data.user.email, email.toLowerCase());

    const persisted = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: true },
    });
    assert.ok(persisted);
    assert.equal(persisted.role, 'STUDENT');
    assert.equal(persisted.emailVerified, true);
    assert.ok(response.headers.get('set-cookie'));
    assert.equal(persisted.studentProfile.firstName, 'José Anne-Marie');
    assert.equal(persisted.studentProfile.lastName, "O'Connor 李");
    assert.equal(persisted.studentProfile.university, 'École 42 — Paris');
    assert.equal(await verifyPassword('Synthetic-Registration-Pass-2026!', persisted.password), true);
    const studentLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'Synthetic-Registration-Pass-2026!' }),
    });
    assert.equal(studentLogin.status, 200);
    assert.equal((await studentLogin.json()).data.user.emailVerified, true);

    const omittedUniversityEmail = `omitted-university.${suffix}@skillsync.test`;
    createdEmails.push(omittedUniversityEmail);
    const omittedUniversity = await register(baseRegistration(omittedUniversityEmail));
    assert.equal(omittedUniversity.response.status, 201);
    const omittedProfile = await prisma.studentProfile.findUnique({
      where: { userId: omittedUniversity.body.data.user.id },
    });
    assert.equal(omittedProfile.university, '');

    const employerEmail = `employer.${suffix}@skillsync.test`;
    createdEmails.push(employerEmail);
    const employerRegistration = await register(baseRegistration(employerEmail, {
      firstName: '  Mei  ',
      lastName: ' Tanaka ',
      companyName: '  Cape Digital Labs  ',
      role: 'EMPLOYER',
    }));
    assert.equal(employerRegistration.response.status, 201);
    assert.equal(employerRegistration.response.headers.get('set-cookie'), null);
    assert.equal(employerRegistration.body.data.user.emailVerified, false);
    const persistedEmployer = await prisma.user.findUnique({
      where: { email: employerEmail },
      include: { employerProfile: true },
    });
    assert.equal(persistedEmployer.role, 'EMPLOYER');
    assert.equal(persistedEmployer.emailVerified, false);
    assert.equal(persistedEmployer.employerProfile.companyName, 'Cape Digital Labs');

    const originalToken = verificationTokenFromLatestEmail();
    assert.equal(JSON.stringify(employerRegistration.body).includes(originalToken), false);
    const originalTokenHash = require('node:crypto').createHash('sha256').update(originalToken).digest('hex');
    const originalTokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: originalTokenHash },
    });
    assert.ok(originalTokenRecord);
    assert.notEqual(originalTokenRecord.tokenHash, originalToken);

    const unverifiedLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employerEmail, password: 'Synthetic-Registration-Pass-2026!' }),
    });
    assert.equal(unverifiedLogin.status, 403);
    assert.equal((await unverifiedLogin.json()).code, 'EMAIL_NOT_VERIFIED');
    assert.equal(unverifiedLogin.headers.get('set-cookie'), null);

    const employerToken = signToken({
      userId: persistedEmployer.id,
      email: employerEmail,
      role: 'EMPLOYER',
    });
    const blockedEmployerRoute = await fetch(`${baseUrl}/employer/profile`, {
      headers: { Authorization: `Bearer ${employerToken}` },
    });
    assert.equal(blockedEmployerRoute.status, 403);
    assert.equal((await blockedEmployerRoute.json()).code, 'EMAIL_NOT_VERIFIED');

    const invalidVerification = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'f'.repeat(64) }),
    });
    assert.equal(invalidVerification.status, 400);

    const sentEmailCountBeforeResend = smtpMessages.length;
    const smtpConnectionsBeforeResend = smtpConnectionCount;
    const resend = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employerEmail.toUpperCase() }),
    });
    assert.equal(resend.status, 202);
    assert.equal(smtpConnectionCount, smtpConnectionsBeforeResend + 1);
    assert.equal(smtpMessages.length, sentEmailCountBeforeResend + 1);
    const replacementToken = verificationTokenFromLatestEmail();
    assert.notEqual(replacementToken, originalToken);
    const oldToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: originalTokenHash },
    });
    assert.equal(oldToken.used, true);
    const replacementHash = require('node:crypto').createHash('sha256').update(replacementToken).digest('hex');
    const replacementRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: replacementHash },
    });
    assert.ok(replacementRecord);
    assert.equal(replacementRecord.used, false);

    const reusedOldToken = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: originalToken }),
    });
    assert.equal(reusedOldToken.status, 400);
    assert.match((await reusedOldToken.json()).message, /already been used/i);

    const verification = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: replacementToken }),
    });
    assert.equal(verification.status, 200);
    assert.equal((await verification.json()).success, true);
    const usedToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: replacementHash },
    });
    assert.equal(usedToken.used, true);
    const verifiedEmployer = await prisma.user.findUnique({
      where: { email: employerEmail },
      include: { employerProfile: true },
    });
    assert.equal(verifiedEmployer.emailVerified, true);
    assert.equal(verifiedEmployer.role, 'EMPLOYER');
    assert.equal(verifiedEmployer.employerProfile.companyName, 'Cape Digital Labs');

    const reusedToken = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: replacementToken }),
    });
    assert.equal(reusedToken.status, 400);
    assert.match((await reusedToken.json()).message, /already been used/i);

    const verifiedLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employerEmail, password: 'Synthetic-Registration-Pass-2026!' }),
    });
    assert.equal(verifiedLogin.status, 200);
    assert.equal((await verifiedLogin.json()).data.user.emailVerified, true);
    const employerCookie = verifiedLogin.headers.get('set-cookie');
    assert.ok(employerCookie);
    const employerProfileResponse = await fetch(`${baseUrl}/employer/profile`, {
      headers: { Cookie: employerCookie.split(';')[0] },
    });
    assert.equal(employerProfileResponse.status, 200);

    const duplicate = await register(baseRegistration(email));
    assert.equal(duplicate.response.status, 409);
    assert.equal(await prisma.user.count({ where: { email: email.toLowerCase() } }), 1);

    for (const address of [
      `gmail.${suffix}@gmail.com`,
      `outlook.${suffix}@outlook.com`,
      `university.${suffix}@university.ac.za`,
      `company.${suffix}@company.co.za`,
    ]) {
      createdEmails.push(address);
      const accepted = await register(baseRegistration(address));
      assert.equal(accepted.response.status, 201, address);
      assert.equal(accepted.body.data.user.email, address);
      assert.equal(accepted.body.data.user.emailVerified, true);
    }

    const shortPassword = await register(baseRegistration(`short-password.${suffix}@skillsync.test`, {
      password: 'short',
    }));
    assert.equal(shortPassword.response.status, 400);
    const restrictedRoleEmail = `admin-role.${suffix}@skillsync.test`;
    const restrictedRole = await register(baseRegistration(restrictedRoleEmail, { role: 'ADMIN' }));
    assert.equal(restrictedRole.response.status, 400);
    assert.equal(await prisma.user.count({ where: { email: restrictedRoleEmail } }), 0);
  });

  test('registration enforces employer email and organisation requirements by role', async () => {
    for (const domain of ['gmail.com', 'yahoo.com', 'outlook.com', 'GMAIL.COM']) {
      const email = `blocked-employer-${suffix}@${domain}`;
      const rejected = await register(baseRegistration(email, {
        role: 'EMPLOYER',
        companyName: 'Cape Digital Labs',
      }));
      assert.equal(rejected.response.status, 400, domain);
      assert.match(JSON.stringify(rejected.body), /organisation email address/i);
      assert.equal(await prisma.user.count({ where: { email: email.toLowerCase() } }), 0);
    }

    const missingCompanyEmail = `missing-company-${suffix}@company.co.za`;
    const missingCompany = await register(baseRegistration(missingCompanyEmail, { role: 'EMPLOYER' }));
    assert.equal(missingCompany.response.status, 400);
    assert.equal(await prisma.user.count({ where: { email: missingCompanyEmail } }), 0);

    const acceptedRegistrations = [
      {
        email: `student-gmail-${suffix}@gmail.com`,
        fields: { role: 'STUDENT', university: 'University of Cape Town' },
      },
      {
        email: `student-outlook-${suffix}@outlook.com`,
        fields: { role: 'STUDENT', university: 'University of Cape Town' },
      },
      {
        email: `business-${suffix}@COMPANY.CO.ZA`,
        fields: { role: 'EMPLOYER', companyName: 'Cape Digital Labs' },
      },
      {
        email: `university-${suffix}@university.ac.za`,
        fields: { role: 'EMPLOYER', companyName: 'Cape Digital Labs' },
      },
    ];

    for (const { email, fields } of acceptedRegistrations) {
      const normalizedEmail = email.toLowerCase();
      createdEmails.push(normalizedEmail);
      const accepted = await register(baseRegistration(email, fields));
      assert.equal(accepted.response.status, 201, email);
      assert.equal(accepted.body.data.user.email, normalizedEmail);
      assert.ok(await prisma.user.findUnique({ where: { email: normalizedEmail } }));
    }
  });

  test('verification links use the configured frontend URL rather than the request Host header', async () => {
    const email = `host-header-${suffix}@company.co.za`;
    createdEmails.push(email);
    const registration = await register(baseRegistration(email, {
      role: 'EMPLOYER',
      companyName: 'Trusted Link Company',
    }), { Host: 'attacker.example' });

    assert.equal(registration.response.status, 201);
    const message = smtpMessages.at(-1).replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
    const verificationLink = message.match(/https?:\/\/[^\s"'<>]+\/verify-email\?token=[a-f\d]{64}/i);
    assert.ok(verificationLink);
    assert.equal(new URL(verificationLink[0]).origin, 'http://localhost:5173');
    assert.equal(verificationLink[0].includes('attacker.example'), false);
  });

  test('concurrent verification attempts consume a token at most once', async () => {
    const email = `concurrent-verify-${suffix}@company.co.za`;
    createdEmails.push(email);
    const registration = await register(baseRegistration(email, {
      role: 'EMPLOYER',
      companyName: 'Concurrent Verification Company',
    }));
    assert.equal(registration.response.status, 201);
    const token = verificationTokenFromLatestEmail();
    const verify = () => fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const responses = await Promise.all([verify(), verify()]);
    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.equal(responses.some((response) => response.status === 429), false);
    const stored = await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash: require('node:crypto').createHash('sha256').update(token).digest('hex'),
      },
    });
    assert.equal(stored.used, true);
    assert.equal((await prisma.user.findUnique({ where: { email } })).emailVerified, true);
  });

  test('concurrent resend operations leave at most one unused token', async () => {
    const email = `concurrent-resend-${suffix}@company.co.za`;
    createdEmails.push(email);
    const registration = await register(baseRegistration(email, {
      role: 'EMPLOYER',
      companyName: 'Concurrent Resend Company',
    }));
    assert.equal(registration.response.status, 201);
    const resend = () => fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const responses = await Promise.all([resend(), resend()]);
    assert.deepEqual(responses.map((response) => response.status), [202, 202]);
    const user = await prisma.user.findUnique({ where: { email } });
    const activeTokens = await prisma.emailVerificationToken.count({
      where: { userId: user.id, used: false },
    });
    assert.ok(activeTokens <= 1);
  });

  test('verification rejects expired links and handles SMTP configuration and delivery failures safely', async () => {
    const expiredEmail = `expired-${suffix}@company.co.za`;
    createdEmails.push(expiredEmail);
    const expiredRegistration = await register(baseRegistration(expiredEmail, {
      role: 'EMPLOYER',
      companyName: 'Expired Token Company',
    }));
    assert.equal(expiredRegistration.response.status, 201);
    const expiredRawToken = verificationTokenFromLatestEmail();
    const expiredHash = require('node:crypto').createHash('sha256').update(expiredRawToken).digest('hex');
    await prisma.emailVerificationToken.update({
      where: { tokenHash: expiredHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredResponse = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredRawToken }),
    });
    assert.equal(expiredResponse.status, 400);
    assert.match((await expiredResponse.json()).message, /expired/i);
    assert.equal((await prisma.user.findUnique({ where: { email: expiredEmail } })).emailVerified, false);

    const originalPort = process.env.SMTP_PORT;
    process.env.SMTP_PORT = '1';
    const failedResend = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: expiredEmail }),
    });
    assert.equal(failedResend.status, 202);
    assert.match((await failedResend.json()).message, /request has been accepted/i);
    const expiredUser = await prisma.user.findUnique({ where: { email: expiredEmail } });
    const expiredToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: expiredHash },
    });
    assert.equal(expiredToken.used, false);
    const failedResendCandidate = await prisma.emailVerificationToken.findFirst({
      where: { userId: expiredUser.id, tokenHash: { not: expiredHash } },
    });
    assert.ok(failedResendCandidate);
    assert.equal(failedResendCandidate.used, true);
    process.env.SMTP_PORT = originalPort;

    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = '';
    const unconfiguredEmail = `unconfigured-${suffix}@company.co.za`;
    const unconfigured = await register(baseRegistration(unconfiguredEmail, {
      role: 'EMPLOYER',
      companyName: 'Unconfigured Mail Company',
    }));
    assert.equal(unconfigured.response.status, 503);
    assert.equal(unconfigured.body.code, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    assert.equal(await prisma.user.count({ where: { email: unconfiguredEmail } }), 0);

    const unconfiguredResend = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unknown-${suffix}@company.co.za` }),
    });
    assert.equal(unconfiguredResend.status, 503);
    assert.equal((await unconfiguredResend.json()).code, 'EMAIL_DELIVERY_NOT_CONFIGURED');

    process.env.SMTP_HOST = originalHost;
    const failedDeliveryEmail = `delivery-failed-${suffix}@company.co.za`;
    createdEmails.push(failedDeliveryEmail);
    process.env.SMTP_PORT = '1';
    const failedDelivery = await register(baseRegistration(failedDeliveryEmail, {
      role: 'EMPLOYER',
      companyName: 'Delivery Failure Company',
    }));
    assert.equal(failedDelivery.response.status, 503);
    assert.equal(failedDelivery.body.code, 'EMAIL_DELIVERY_FAILED');
    assert.equal(JSON.stringify(failedDelivery.body).includes('token'), false);
    const failedUser = await prisma.user.findUnique({ where: { email: failedDeliveryEmail } });
    assert.ok(failedUser);
    assert.equal(failedUser.emailVerified, false);
    const invalidatedToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: failedUser.id },
    });
    assert.equal(invalidatedToken.used, true);
    process.env.SMTP_PORT = originalPort;

    const missingEmailRequest = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `not-registered-${suffix}@company.co.za` }),
    });
    const existingStudentRequest = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `jose.${suffix}@skillsync.test` }),
    });
    assert.equal(missingEmailRequest.status, existingStudentRequest.status);
    assert.deepEqual(await missingEmailRequest.json(), await existingStudentRequest.json());
  });

  test('verification requests are rate limited', async () => {
    let rateLimited = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${baseUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `rate-limit-${suffix}@company.co.za` }),
      });
      if (response.status === 429) {
        rateLimited = true;
        break;
      }
      assert.equal(response.status, 202);
    }
    assert.equal(rateLimited, true);

    let verificationRateLimited = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(`${baseUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'f'.repeat(64) }),
      });
      if (response.status === 429) {
        verificationRateLimited = true;
        break;
      }
      assert.equal(response.status, 400);
    }
    assert.equal(verificationRateLimited, true);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const email = `rate-limit-register-${attempt}-${suffix}@skillsync.test`;
      createdEmails.push(email);
      const response = await fetch(`${baseUrl}/rate-limited-auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRegistration(email)),
      });
      assert.equal(response.status, 201);
    }
    const registrationRateLimited = await fetch(`${baseUrl}/rate-limited-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseRegistration(`rate-limit-register-blocked-${suffix}@skillsync.test`)),
    });
    assert.equal(registrationRateLimited.status, 429);
  });

  test('student and employer registration reject passwords that fail complexity requirements', async () => {
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
      '',
    ];

    for (const role of ['STUDENT', 'EMPLOYER']) {
      for (const [index, password] of invalidPasswords.entries()) {
        const email = `weak-${role.toLowerCase()}-${index}.${suffix}@skillsync.test`;
        const { response, body } = await register(baseRegistration(email, {
          password,
          role,
          ...(role === 'EMPLOYER' ? { companyName: 'Cape Digital Labs' } : { university: 'University of Cape Town' }),
        }));
        assert.equal(response.status, 400, `${role} password case ${index}`);
        if (password) {
          assert.equal(JSON.stringify(body).includes(password), false, `${role} password case ${index} echoed password`);
        }
        assert.equal(await prisma.user.count({ where: { email } }), 0, `${role} password case ${index} persisted`);
      }
    }
  });

  test('password reset rejects passwords that fail complexity requirements', async () => {
    const password = 'Password1234';
    const response = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64), password }),
    });
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.equal(body.includes(password), false);
    assert.match(body, /special character/);
  });
}
