const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

const testDatabaseUrl = process.env.SKILLSYNC_TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  test('Prisma matching integration requires SKILLSYNC_TEST_DATABASE_URL', { skip: true }, () => {});
} else {
  if (!/^file:.*test/i.test(testDatabaseUrl)) {
    throw new Error('SKILLSYNC_TEST_DATABASE_URL must be an isolated SQLite URL containing "test" in its path.');
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET ??= 'integration-test-secret-that-is-long-enough';

  const prisma = require('../../dist/config/database').default;
  const matchingService = require('../../dist/services/matchingService').default;
  const { hashPassword } = require('../../dist/utils/password');
  const { authenticate, authorize } = require('../../dist/middleware/auth');
  const { signToken } = require('../../dist/utils/jwt');
  const employerRoutes = require('../../dist/routes/employer').default;
  const internshipRoutes = require('../../dist/routes/internships').default;
  const studentRoutes = require('../../dist/routes/student').default;
  const skillRoutes = require('../../dist/routes/skills').default;
  const adminRoutes = require('../../dist/routes/admin').default;
  const { errorHandler } = require('../../dist/middleware/errorHandler');

  const suffix = `${process.pid}-${Date.now()}`;
  const studentEmail = `amara.${suffix}@skillsync.test`;
  const employerEmail = `talent.${suffix}@skillsync.test`;
  const skillName = `TEST: TypeScript ${suffix}`;
  let studentUserId;
  let employerUserId;
  let authUserId;
  let auditUserId;
  let skillId;
  let matchingInternshipId;
  let applicationId;
  let createdInternshipId;
  const additionalInternshipIds = [];
  let adminUserId;
  let adminSkillId;
  let adminInternshipId;
  let baseUrl;

  const app = express();
  app.use(express.json());
  app.use('/internships', internshipRoutes);
  app.use('/student', studentRoutes);
  app.use('/skills', skillRoutes);
  app.use('/employer', employerRoutes);
  app.use('/admin', adminRoutes);
  app.use(errorHandler);

  before(async () => {
    await prisma.$connect();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    app.server = server;
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
  // Remove application records before deleting their related users or internships.
  if (applicationId) {
    await prisma.application.deleteMany({ where: { id: applicationId } });
  }

  // Remove internships created by the integration tests.
  if (adminInternshipId) {
    await prisma.internship.deleteMany({ where: { id: adminInternshipId } });
  }

  if (createdInternshipId) {
    await prisma.internship.deleteMany({ where: { id: createdInternshipId } });
  }

  if (matchingInternshipId) {
    await prisma.internship.deleteMany({ where: { id: matchingInternshipId } });
  }

  if (additionalInternshipIds.length > 0) {
    await prisma.internship.deleteMany({
      where: { id: { in: additionalInternshipIds } },
    });
  }

  // Remove test skills and users.
  if (adminSkillId) {
    await prisma.skill.deleteMany({ where: { id: adminSkillId } });
  }

  if (auditUserId) {
    await prisma.user.deleteMany({ where: { id: auditUserId } });
  }

  if (adminUserId) {
    await prisma.user.deleteMany({ where: { id: adminUserId } });
  }

  if (studentUserId) {
    await prisma.user.deleteMany({ where: { id: studentUserId } });
  }

  if (employerUserId) {
    await prisma.user.deleteMany({ where: { id: employerUserId } });
  }

  if (authUserId) {
    await prisma.user.deleteMany({ where: { id: authUserId } });
  }

  if (skillId) {
    await prisma.skill.deleteMany({ where: { id: skillId } });
  }

  await new Promise((resolve, reject) =>
    app.server.close((error) => error ? reject(error) : resolve())
  );

  await prisma.$disconnect();
});

  const sendRequest = async (path, { method = 'GET', userId, role, body } = {}) => {
    const token = signToken({ userId, email: `${role.toLowerCase()}@skillsync.test`, role });
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return { response, body: await response.json() };
  };

  test('student skills, employer requirements, matching, and application persist together', async () => {
    const student = await prisma.user.create({
      data: {
        email: studentEmail,
        password: await hashPassword('Synthetic-Student-Pass-2026!'),
        role: 'STUDENT',
        studentProfile: {
          create: {
            firstName: 'Amara',
            lastName: 'Ndlovu',
            university: 'University of Cape Town',
            degree: 'BSc Computer Science',
          },
        },
      },
      include: { studentProfile: true },
    });
    studentUserId = student.id;

    const employer = await prisma.user.create({
      data: {
        email: employerEmail,
        password: await hashPassword('Synthetic-Employer-Pass-2026!'),
        role: 'EMPLOYER',
        emailVerified: true,
        employerProfile: { create: { companyName: 'Cape Digital Labs' } },
      },
      include: { employerProfile: true },
    });
    employerUserId = employer.id;

    const skill = await prisma.skill.create({
      data: { name: skillName, category: 'PROGRAMMING' },
    });
    skillId = skill.id;

    const internship = await prisma.internship.create({
      data: {
        employerProfileId: employer.employerProfile.id,
        title: 'Junior Software Developer Intern',
        description: 'A synthetic integration-test posting.',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        requiredSkills: {
          create: [{ skillId: skill.id, importance: 5, minimumLevel: 'INTERMEDIATE' }],
        },
      },
    });
    matchingInternshipId = internship.id;

    await prisma.studentSkill.create({
      data: {
        studentProfileId: student.studentProfile.id,
        skillId: skill.id,
        proficiency: 'ADVANCED',
      },
    });

    const score = await matchingService.calculateMatchScore(student.studentProfile.id, internship.id);
    assert.equal(score.overall, 100);
    assert.equal(score.stats.fullMatches, 1);

    const ranked = await matchingService.getTopMatches(student.studentProfile.id, 10);
    assert.equal(ranked[0].id, internship.id);
    assert.equal(ranked[0].matchScore, 100);

    const application = await prisma.application.create({
      data: {
        studentProfileId: student.studentProfile.id,
        internshipId: internship.id,
        matchScore: score.overall,
      },
      include: { studentProfile: true, internship: true },
    });
    applicationId = application.id;
    assert.equal(application.studentProfile.userId, student.id);
    assert.equal(application.internship.id, internship.id);
    assert.equal(application.status, 'PENDING');
  });

  test('employer internship creation rejects invalid requirements without partial writes and accepts valid data', async () => {
    const employerProfile = await prisma.employerProfile.findUnique({ where: { userId: employerUserId } });
    const ownerId = employerProfile.id;
    const countBefore = await prisma.internship.count({ where: { employerProfileId: ownerId } });
    const requirementsBefore = await prisma.internshipSkill.count();
    const validPayload = {
      title: 'Database-verified internship',
      description: 'A synthetic route integration test.',
      location: 'Cape Town',
      durationMonths: 6,
      applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      skills: [{ skillId, importance: 5, minimumLevel: 'INTERMEDIATE' }],
    };
    const create = (skills) => sendRequest('/employer/internships', {
      method: 'POST',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: { ...validPayload, skills },
    });

    const emptySkills = await create([]);
    assert.equal(emptySkills.response.status, 400);
    assert.match(emptySkills.body.errors.join(' '), /skills must contain between 1 and 50 items/i);
    assert.equal(await prisma.internship.count({ where: { employerProfileId: ownerId } }), countBefore);
    assert.equal(await prisma.internshipSkill.count(), requirementsBefore);

    const duplicateSkills = await create([
      { skillId, importance: 5, minimumLevel: 'INTERMEDIATE' },
      { skillId, importance: 3, minimumLevel: 'BEGINNER' },
    ]);
    assert.equal(duplicateSkills.response.status, 400);
    assert.match(duplicateSkills.body.errors.join(' '), /only be selected once/i);
    assert.equal(await prisma.internship.count({ where: { employerProfileId: ownerId } }), countBefore);
    assert.equal(await prisma.internshipSkill.count(), requirementsBefore);

    const unknownSkill = await create([
      { skillId: `missing-skill-${suffix}`, importance: 3, minimumLevel: 'BEGINNER' },
    ]);
    assert.equal(unknownSkill.response.status, 400);
    assert.match(unknownSkill.body.message, /required skills do not exist/i);
    assert.equal(await prisma.internship.count({ where: { employerProfileId: ownerId } }), countBefore);
    assert.equal(await prisma.internshipSkill.count(), requirementsBefore);

    const invalidRequirement = await create([
      { skillId, importance: 6, minimumLevel: 'MASTER' },
    ]);
    assert.equal(invalidRequirement.response.status, 400);
    assert.ok(invalidRequirement.body.errors.length > 0);
    assert.equal(await prisma.internship.count({ where: { employerProfileId: ownerId } }), countBefore);
    assert.equal(await prisma.internshipSkill.count(), requirementsBefore);

    const validCreation = await create(validPayload.skills);
    assert.equal(validCreation.response.status, 201);
    assert.equal(validCreation.body.data.requiredSkills.length, 1);
    assert.equal(validCreation.body.data.requiredSkills[0].skillId, skillId);
    assert.equal(validCreation.body.data.requiredSkills[0].importance, 5);
    assert.equal(validCreation.body.data.requiredSkills[0].minimumLevel, 'INTERMEDIATE');
    createdInternshipId = validCreation.body.data.id;

    const searchResponse = await fetch(`${baseUrl}/internships?search=database-verified`);
    const searchBody = await searchResponse.json();
    assert.equal(searchResponse.status, 200);
    assert.ok(searchBody.data.some(({ id }) => id === createdInternshipId));

    for (const currency of ['ZAR', 'USD', 'EUR']) {
      const currencyCreation = await sendRequest('/employer/internships', {
        method: 'POST',
        userId: employerUserId,
        role: 'EMPLOYER',
        body: { ...validPayload, title: `Currency test ${currency}`, currency },
      });
      assert.equal(currencyCreation.response.status, 201);
      assert.equal(currencyCreation.body.data.currency, currency);
      additionalInternshipIds.push(currencyCreation.body.data.id);
    }

    const unsupportedCurrency = await sendRequest('/employer/internships', {
      method: 'POST',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: { ...validPayload, currency: 'GBP' },
    });
    assert.equal(unsupportedCurrency.response.status, 400);
    assert.match(unsupportedCurrency.body.errors.join(' '), /currency must be one of/i);
    assert.equal(await prisma.internship.count({ where: { employerProfileId: ownerId } }), countBefore + 4);

    const editUnsupportedCurrency = await sendRequest(`/employer/internships/${createdInternshipId}`, {
      method: 'PUT',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: { title: 'Must remain unchanged', skills: [] },
    });
    assert.equal(editUnsupportedCurrency.response.status, 400);
    assert.match(editUnsupportedCurrency.body.errors.join(' '), /skills must contain between 1 and 50 items/i);
    const unchanged = await prisma.internship.findUnique({
      where: { id: createdInternshipId },
      include: { requiredSkills: true },
    });
    assert.equal(unchanged.title, 'Database-verified internship');
    assert.equal(unchanged.requiredSkills.length, 1);
    assert.equal(unchanged.requiredSkills[0].skillId, skillId);

    const updateUnknownSkill = await sendRequest(`/employer/internships/${createdInternshipId}`, {
      method: 'PUT',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: {
        title: 'Must remain unchanged',
        skills: [{ skillId: `missing-skill-${suffix}`, importance: 3, minimumLevel: 'BEGINNER' }],
      },
    });
    assert.equal(updateUnknownSkill.response.status, 400);
    assert.match(updateUnknownSkill.body.message, /required skills do not exist/i);
    const unchangedAfterUnknownSkill = await prisma.internship.findUnique({
      where: { id: createdInternshipId },
      include: { requiredSkills: true },
    });
    assert.equal(unchangedAfterUnknownSkill.title, 'Database-verified internship');
    assert.equal(unchangedAfterUnknownSkill.requiredSkills.length, 1);
    assert.equal(unchangedAfterUnknownSkill.requiredSkills[0].skillId, skillId);

    const invalidCurrencyUpdate = await sendRequest(`/employer/internships/${createdInternshipId}`, {
      method: 'PUT',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: { currency: 'GBP' },
    });
    assert.equal(invalidCurrencyUpdate.response.status, 400);
    assert.match(invalidCurrencyUpdate.body.errors.join(' '), /currency must be one of/i);
    const supportedCurrencyUpdate = await sendRequest(`/employer/internships/${createdInternshipId}`, {
      method: 'PUT',
      userId: employerUserId,
      role: 'EMPLOYER',
      body: { currency: 'EUR' },
    });
    assert.equal(supportedCurrencyUpdate.response.status, 200);
    assert.equal(supportedCurrencyUpdate.body.data.currency, 'EUR');
  });

  test('student profile updates validate numeric values, support clearing, and reject blank names', async () => {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentUserId } });
    const update = (body) => sendRequest('/student/profile', {
      method: 'PUT',
      userId: studentUserId,
      role: 'STUDENT',
      body,
    });

    const validNumbers = await update({ yearOfStudy: 3, gpa: 3.5 });
    assert.equal(validNumbers.response.status, 200);
    assert.equal(validNumbers.body.data.yearOfStudy, 3);
    assert.equal(validNumbers.body.data.gpa, 3.5);

    const blankNumbers = await update({ yearOfStudy: null, gpa: null });
    assert.equal(blankNumbers.response.status, 200);
    assert.equal(blankNumbers.body.data.yearOfStudy, null);
    assert.equal(blankNumbers.body.data.gpa, null);

    for (const body of [
      { yearOfStudy: '3' },
      { yearOfStudy: 21 },
      { gpa: -1 },
      { firstName: '' },
      { firstName: '   ' },
      { lastName: '' },
      { lastName: '   ' },
    ]) {
      const result = await update(body);
      assert.equal(result.response.status, 400, JSON.stringify(body));
      assert.ok(result.body.errors.length > 0);
    }

    const trimmedNames = await update({ firstName: '  Amara  ', lastName: ' Ndlovu ' });
    assert.equal(trimmedNames.response.status, 200);
    assert.equal(trimmedNames.body.data.firstName, 'Amara');
    assert.equal(trimmedNames.body.data.lastName, 'Ndlovu');

    const unrelatedField = await update({ city: 'Stellenbosch' });
    assert.equal(unrelatedField.response.status, 200);
    assert.equal(unrelatedField.body.data.city, 'Stellenbosch');
    assert.equal(unrelatedField.body.data.firstName, 'Amara');

    const unchanged = await prisma.studentProfile.findUnique({ where: { id: profile.id } });
    assert.equal(unchanged.yearOfStudy, null);
    assert.equal(unchanged.gpa, null);
  });

  test('employer company name rejects blank values while allowing trimmed and unrelated updates', async () => {
    const update = (body) => sendRequest('/employer/profile', {
      method: 'PUT',
      userId: employerUserId,
      role: 'EMPLOYER',
      body,
    });

    for (const companyName of ['', '   ']) {
      const result = await update({ companyName });
      assert.equal(result.response.status, 400);
      assert.ok(result.body.errors.length > 0);
    }

    const trimmed = await update({ companyName: '  Cape Digital Labs Updated  ' });
    assert.equal(trimmed.response.status, 200);
    assert.equal(trimmed.body.data.companyName, 'Cape Digital Labs Updated');

    const unrelatedField = await update({ description: 'Updated company description.' });
    assert.equal(unrelatedField.response.status, 200);
    assert.equal(unrelatedField.body.data.companyName, 'Cape Digital Labs Updated');
    assert.equal(unrelatedField.body.data.description, 'Updated company description.');
  });

  test('student skill updates reject empty payloads and allow meaningful partial updates', async () => {
    const studentSkill = await prisma.studentSkill.findUnique({
      where: { studentProfileId_skillId: {
        studentProfileId: (await prisma.studentProfile.findUnique({ where: { userId: studentUserId } })).id,
        skillId,
      } },
    });
    const update = (body) => sendRequest(`/skills/my-skills/${studentSkill.id}`, {
      method: 'PUT',
      userId: studentUserId,
      role: 'STUDENT',
      body,
    });

    const empty = await update({});
    assert.equal(empty.response.status, 400);
    assert.match(empty.body.errors.join(' '), /at least one skill field/i);

    const partial = await update({ proficiency: 'EXPERT' });
    assert.equal(partial.response.status, 200);
    assert.equal(partial.body.data.proficiency, 'EXPERT');
  });

  test('admin resource operations return 404 only for missing records and preserve valid writes', async () => {
    const admin = await prisma.user.create({
      data: {
        email: `admin.${suffix}@skillsync.test`,
        password: await hashPassword('Synthetic-Admin-Pass-2026!'),
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;
    const employerProfile = await prisma.employerProfile.findUnique({ where: { userId: employerUserId } });
    const adminSkill = await prisma.skill.create({
      data: { name: `TEST: Admin skill ${suffix}`, category: 'PROGRAMMING' },
    });
    adminSkillId = adminSkill.id;
    const adminInternship = await prisma.internship.create({
      data: {
        employerProfileId: employerProfile.id,
        title: `TEST: Admin internship ${suffix}`,
        description: 'A synthetic Admin resource test.',
      },
    });
    adminInternshipId = adminInternship.id;

    const adminRequest = (path, method, body) => sendRequest(path, {
      method,
      userId: adminUserId,
      role: 'ADMIN',
      ...(body !== undefined && { body }),
    });

    for (const name of ['', '   ']) {
      const blankName = await adminRequest(`/admin/skills/${adminSkillId}`, 'PUT', { name });
      assert.equal(blankName.response.status, 400);
      assert.ok(blankName.body.errors.length > 0);
    }

    const trimmedName = await adminRequest(`/admin/skills/${adminSkillId}`, 'PUT', {
      name: `  TEST: Admin skill ${suffix} renamed  `,
    });
    assert.equal(trimmedName.response.status, 200);
    assert.equal(trimmedName.body.data.name, `TEST: Admin skill ${suffix} renamed`);

    const categoryOnly = await adminRequest(`/admin/skills/${adminSkillId}`, 'PUT', {
      category: 'TOOL',
    });
    assert.equal(categoryOnly.response.status, 200);
    assert.equal(categoryOnly.body.data.name, `TEST: Admin skill ${suffix} renamed`);
    assert.equal(categoryOnly.body.data.category, 'TOOL');

    for (const [path, method, body, message] of [
      [`/admin/internships/missing-${suffix}`, 'PATCH', { title: 'Updated title' }, /internship not found/i],
      [`/admin/internships/missing-${suffix}`, 'DELETE', undefined, /internship not found/i],
      [`/admin/skills/missing-${suffix}`, 'PUT', { name: 'Updated skill' }, /skill not found/i],
      [`/admin/skills/missing-${suffix}`, 'DELETE', undefined, /skill not found/i],
    ]) {
      const result = await adminRequest(path, method, body);
      assert.equal(result.response.status, 404);
      assert.match(result.body.message, message);
    }

    const updatedInternship = await adminRequest(`/admin/internships/${adminInternshipId}`, 'PATCH', {
      title: 'Updated synthetic internship',
      status: 'CLOSED',
    });
    assert.equal(updatedInternship.response.status, 200);
    assert.equal(updatedInternship.body.data.title, 'Updated synthetic internship');
    assert.equal(updatedInternship.body.data.status, 'CLOSED');

    const conflictingSkillUpdate = await adminRequest(`/admin/skills/${adminSkillId}`, 'PUT', { name: skillName });
    assert.equal(conflictingSkillUpdate.response.status, 500);
    assert.equal(conflictingSkillUpdate.body.message, 'An unexpected error occurred. Please try again.');

    const updatedSkill = await adminRequest(`/admin/skills/${adminSkillId}`, 'PUT', { name: `TEST: Updated admin skill ${suffix}` });
    assert.equal(updatedSkill.response.status, 200);
    assert.equal(updatedSkill.body.data.name, `TEST: Updated admin skill ${suffix}`);

    const deletedInternship = await adminRequest(`/admin/internships/${adminInternshipId}`, 'DELETE');
    assert.equal(deletedInternship.response.status, 200);
    adminInternshipId = undefined;
    const deletedSkill = await adminRequest(`/admin/skills/${adminSkillId}`, 'DELETE');
    assert.equal(deletedSkill.response.status, 200);
    adminSkillId = undefined;
  });

  test('deleting a skill or user preserves recommendations and audit logs without dangling references', async () => {
  // Create a dedicated student account without any applications.
  const auditStudent = await prisma.user.create({
    data: {
      email: `audit-student.${suffix}@skillsync.test`,
      password: await hashPassword('Synthetic-Audit-Student-Pass-2026!'),
      role: 'STUDENT',
      studentProfile: {
        create: {
          firstName: 'Audit',
          lastName: 'Student',
          university: 'University of Pretoria',
          degree: 'BSc Information Technology',
        },
      },
    },
    include: { studentProfile: true },
  });

  auditUserId = auditStudent.id;

  const recommendation = await prisma.recommendation.create({
    data: {
      studentProfileId: auditStudent.studentProfile.id,
      type: 'skill_gap',
      title: 'Practice test skill',
      description: 'Synthetic relation-integrity test.',
      skillId,
    },
  });

  const auditLog = await prisma.auditLog.create({
    data: {
      userId: auditUserId,
      action: 'create',
      entityType: 'recommendation',
      entityId: recommendation.id,
    },
  });

  // Deleting the skill should preserve the recommendation
  // while setting its optional skill reference to null.
  await prisma.skill.delete({ where: { id: skillId } });

  const retainedRecommendation = await prisma.recommendation.findUnique({
    where: { id: recommendation.id },
  });

  assert.equal(retainedRecommendation.skillId, null);
  skillId = undefined;

  // Deleting the dedicated student should set the audit log's
  // optional user reference to null.
  await prisma.user.delete({ where: { id: auditUserId } });

  const retainedAuditLog = await prisma.auditLog.findUnique({
    where: { id: auditLog.id },
  });

  assert.equal(retainedAuditLog.userId, null);
  auditUserId = undefined;
});

  test('database-backed authentication rejects deleted users and stale roles', async () => {
    const user = await prisma.user.create({
      data: {
        email: `auth-check.${suffix}@skillsync.test`,
        password: await hashPassword('Synthetic-Auth-Check-Pass-2026!'),
        role: 'STUDENT',
        studentProfile: {
          create: { firstName: 'Tumi', lastName: 'Test', university: 'University of Pretoria' },
        },
      },
    });
    authUserId = user.id;

    const app = express();
    app.get('/student', authenticate, authorize('STUDENT'), (req, res) => res.json({ user: req.user }));
    app.get('/employer', authenticate, authorize('EMPLOYER'), (req, res) => res.json({ user: req.user }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const studentToken = signToken({ userId: user.id, email: user.email, role: 'STUDENT' });
      const validResponse = await fetch(`${baseUrl}/student`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(validResponse.status, 200);
      assert.equal((await validResponse.json()).user.role, 'STUDENT');

      await prisma.user.update({ where: { id: user.id }, data: { role: 'EMPLOYER', emailVerified: true } });
      const staleRoleResponse = await fetch(`${baseUrl}/student`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(staleRoleResponse.status, 401);

      const employerToken = signToken({ userId: user.id, email: user.email, role: 'EMPLOYER' });
      const updatedRoleResponse = await fetch(`${baseUrl}/employer`, {
        headers: { Authorization: `Bearer ${employerToken}` },
      });
      assert.equal(updatedRoleResponse.status, 200);

      await prisma.user.delete({ where: { id: user.id } });
      const deletedUserResponse = await fetch(`${baseUrl}/employer`, {
        headers: { Authorization: `Bearer ${employerToken}` },
      });
      assert.equal(deletedUserResponse.status, 401);
      authUserId = undefined;
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
}