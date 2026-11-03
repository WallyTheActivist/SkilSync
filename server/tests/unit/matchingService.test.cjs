const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.JWT_SECRET ??= 'unit-test-secret-that-is-long-enough-for-signing';

const prisma = require('../../dist/config/database').default;
const matchingService = require('../../dist/services/matchingService').default;
const { studentSkills, internshipSkills, gapInternships } = require('../fixtures/scenario.cjs');

const stub = (testContext, delegate, methodName, implementation) => {
  const original = delegate[methodName];
  delegate[methodName] = implementation;
  testContext.after(() => { delegate[methodName] = original; });
};

test('match score weights required skills, partial proficiency, missing skills, and bonuses', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => studentSkills);
  stub(t, prisma.internshipSkill, 'findMany', async () => internshipSkills);

  const result = await matchingService.calculateMatchScore('student-profile-test-001', 'internship-test-001');

  assert.equal(result.overall, 66);
  assert.equal(result.label, 'Good Match');
  assert.deepEqual(result.stats, {
    fullMatches: 1,
    partialMatches: 1,
    missingCount: 1,
    earnedPoints: 28.8,
    maxPoints: 45,
  });
  assert.equal(result.breakdown.missing[0].skillName, 'SQL');
  assert.equal(result.breakdown.bonus.length, 1);
});

test('bonus skill selection is deterministic across repeated calculations', async (t) => {
  const studentSkillSet = [
    { skillId: 'skill-z', skill: { name: 'Zebra' }, proficiency: 'ADVANCED' },
    { skillId: 'skill-a', skill: { name: 'Alpha' }, proficiency: 'EXPERT' },
    { skillId: 'skill-m', skill: { name: 'Markdown' }, proficiency: 'INTERMEDIATE' },
    { skillId: 'skill-r', skill: { name: 'React' }, proficiency: 'ADVANCED' },
  ];
  stub(t, prisma.studentSkill, 'findMany', async () => studentSkillSet);
  stub(t, prisma.internshipSkill, 'findMany', async () => [
    { skillId: 'skill-r', importance: 3, minimumLevel: 'BEGINNER', skill: { name: 'React' } },
  ]);

  const first = await matchingService.calculateMatchScore('student-profile-test-001', 'internship-test-001');
  const second = await matchingService.calculateMatchScore('student-profile-test-001', 'internship-test-001');

  assert.deepEqual(first.breakdown.bonus.map((bonus) => bonus.skillName), ['Alpha', 'Markdown', 'Zebra']);
  assert.deepEqual(second.breakdown.bonus.map((bonus) => bonus.skillName), ['Alpha', 'Markdown', 'Zebra']);
  assert.equal(first.overall, second.overall);
});

test('match score is unavailable when no skills are required', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => []);
  stub(t, prisma.internshipSkill, 'findMany', async () => []);

  const result = await matchingService.calculateMatchScore('student-profile-test-001', 'internship-test-001');

  assert.equal(result.overall, null);
  assert.equal(result.label, 'Not enough information');
  assert.equal(result.stats.maxPoints, 0);
});

test('readiness calculation applies weighted skill and application components', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => [
    { skillId: 'skill-js-test', proficiency: 'ADVANCED' },
    { skillId: 'skill-python-test', proficiency: 'BEGINNER' },
  ]);
  stub(t, prisma.internship, 'findMany', async () => []);
  stub(t, prisma.application, 'findMany', async () => [{ status: 'SHORTLISTED' }]);

  const result = await matchingService.calculateReadinessScore('student-profile-test-001');

  assert.equal(result.overall, 25);
  assert.equal(result.components.skillCount.score, 20);
  assert.equal(result.components.skillProficiency.score, 50);
  assert.equal(result.components.internshipCompatibility.score, 0);
  assert.equal(result.components.applicationHistory.score, 55);
});

test('readiness samples active internships in deterministic creation order with id tie-breaks', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => []);
  let internshipQuery;
  stub(t, prisma.internship, 'findMany', async (args) => {
    internshipQuery = args;
    return Array.from({ length: 25 }, (_, index) => ({ id: `internship-${String(index + 1).padStart(2, '0')}` }))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 20);
  });
  stub(t, prisma.application, 'findMany', async () => []);

  await matchingService.calculateReadinessScore('student-profile-test-001');

  assert.deepEqual(internshipQuery.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
  assert.equal(internshipQuery.take, 20);
  assert.equal(internshipQuery.where.status, 'ACTIVE');
});

test('readiness compatibility averages only internships with required skills', async (t) => {
  const studentSkill = {
    skillId: 'skill-js-test',
    proficiency: 'ADVANCED',
    skill: { name: 'JavaScript' },
  };
  stub(t, prisma.studentSkill, 'findMany', async () => [studentSkill]);
  stub(t, prisma.internship, 'findMany', async () => [
    { id: 'internship-scorable' },
    { id: 'internship-no-requirements' },
  ]);
  stub(t, prisma.internshipSkill, 'findMany', async ({ where }) => where.internshipId === 'internship-scorable'
    ? [{ skillId: 'skill-js-test', importance: 3, minimumLevel: 'INTERMEDIATE', skill: { name: 'JavaScript' } }]
    : []);
  stub(t, prisma.application, 'findMany', async () => []);

  const result = await matchingService.calculateReadinessScore('student-profile-test-001');

  assert.equal(result.components.internshipCompatibility.score, 100);
  assert.equal(result.components.internshipCompatibility.rawValue, 1);
  assert.equal(result.components.internshipCompatibility.label, '100% avg match across 1 listing');
});

test('skill gap analysis distinguishes missing and weak skills and ranks by impact', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => [studentSkills[0]]);
  let internshipCall = 0;
  stub(t, prisma.internship, 'findMany', async () => {
    internshipCall += 1;
    return internshipCall === 1 ? gapInternships : [];
  });
  stub(t, prisma.application, 'findMany', async () => []);

  const result = await matchingService.getSkillGapAnalysis('student-profile-test-001');

  assert.equal(result.topGaps[0].skillName, 'JavaScript');
  assert.equal(result.topGaps[0].gapType, 'weak');
  assert.equal(result.topGaps[0].frequency, 2);
  assert.deepEqual(result.missingSkills.map((gap) => gap.skillName), ['React', 'SQL']);
  assert.equal(result.strongSkills[0].skillName, 'JavaScript');
  assert.equal(result.strongSkills[0].applicableInternships, 2);
});

test('skill gap aggregation uses the highest required proficiency for duplicate skills', async (t) => {
  stub(t, prisma.studentSkill, 'findMany', async () => [
    { skillId: 'skill-java-test', skill: { name: 'Java', category: 'PROGRAMMING' }, proficiency: 'INTERMEDIATE' },
  ]);
  stub(t, prisma.internship, 'findMany', async () => [{
    title: 'Java internship A',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    id: 'internship-java-001',
    requiredSkills: [
      { skillId: 'skill-java-test', skill: { name: 'Java', category: 'PROGRAMMING' }, minimumLevel: 'BEGINNER' },
    ],
  }, {
    title: 'Java internship B',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    id: 'internship-java-002',
    requiredSkills: [
      { skillId: 'skill-java-test', skill: { name: 'Java', category: 'PROGRAMMING' }, minimumLevel: 'ADVANCED' },
    ],
  }]);
  stub(t, prisma.application, 'findMany', async () => []);

  const result = await matchingService.getSkillGapAnalysis('student-profile-test-001');

  assert.equal(result.topGaps.length, 1);
  assert.equal(result.topGaps[0].skillName, 'Java');
  assert.equal(result.topGaps[0].requiredLevel, 'ADVANCED');
  assert.equal(result.topGaps[0].gapType, 'weak');
  assert.equal(result.topGaps[0].frequency, 2);
  assert.equal(result.weakSkills.length, 1);
  assert.equal(result.weakSkills[0].requiredLevel, 'ADVANCED');
  assert.deepEqual(result.weakSkills[0].internships.map((title) => title), ['Java internship A', 'Java internship B']);
});

const setupRecommendationReconciliation = (testContext, initialRecords = []) => {
  stub(testContext, prisma.studentSkill, 'findMany', async () => [studentSkills[0]]);
  const records = initialRecords.map((record) => ({ ...record }));
  stub(testContext, prisma.internship, 'findMany', async (args) => {
    return args.select?.id ? [] : gapInternships;
  });
  stub(testContext, prisma.application, 'findMany', async () => []);

  const transaction = {
    recommendation: {
      findMany: async () => records.map((record) => ({ ...record })),
      upsert: async ({ where, create, update }) => {
        const index = records.findIndex((record) => record.id === where.id);
        if (index === -1) {
          const created = { ...create, isCompleted: create.isCompleted ?? false };
          records.push(created);
          return created;
        }
        records[index] = { ...records[index], ...update };
        return records[index];
      },
      deleteMany: async ({ where }) => {
        const obsoleteIds = new Set(where.id.in);
        const before = records.length;
        for (let index = records.length - 1; index >= 0; index -= 1) {
          if (obsoleteIds.has(records[index].id)) records.splice(index, 1);
        }
        return { count: before - records.length };
      },
    },
  };
  stub(testContext, prisma, '$transaction', async (callback) => callback(transaction));

  return records;
};

const recommendationRecord = ({
  id,
  title,
  type = 'skill_gap',
  skillId = null,
  isCompleted = false,
}) => ({
  id,
  studentProfileId: 'student-profile-test-001',
  type,
  title,
  description: 'Existing description',
  resourceUrl: null,
  priority: 1,
  skillId,
  isCompleted,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

test('recommendation generation creates new gap and course recommendations', async (t) => {
  const records = setupRecommendationReconciliation(t);

  await matchingService.generateRecommendations('student-profile-test-001');

  assert.ok(records.some((item) => item.title === 'Add SQL to your profile'));
  assert.ok(records.some((item) => item.title.startsWith('Course:')));
  assert.equal(records.some((item) => item.title === 'Learn JavaScript'), false);
});

test('regeneration preserves an existing incomplete recommendation', async (t) => {
  const existing = recommendationRecord({
    id: 'recommendation-incomplete',
    title: 'JavaScript proficiency needs improvement',
    skillId: 'skill-js-test',
  });
  const records = setupRecommendationReconciliation(t, [existing]);

  await matchingService.generateRecommendations('student-profile-test-001');

  const current = records.find((item) => item.id === existing.id);
  assert.equal(current.isCompleted, false);
  assert.notEqual(current.description, existing.description);
});

test('regeneration preserves an existing completed recommendation', async (t) => {
  const existing = recommendationRecord({
    id: 'recommendation-completed',
    title: 'Add SQL to your profile',
    skillId: 'skill-sql-test',
    isCompleted: true,
  });
  const records = setupRecommendationReconciliation(t, [existing]);

  await matchingService.generateRecommendations('student-profile-test-001');

  const current = records.find((item) => item.id === existing.id);
  assert.equal(current.isCompleted, true);
  assert.notEqual(current.description, existing.description);
});

test('regeneration adds new recommendations while retaining still-applicable ones', async (t) => {
  const existing = recommendationRecord({
    id: 'recommendation-existing',
    title: 'Add SQL to your profile',
    skillId: 'skill-sql-test',
  });
  const records = setupRecommendationReconciliation(t, [existing]);

  await matchingService.generateRecommendations('student-profile-test-001');

  assert.ok(records.some((item) => item.id === existing.id));
  assert.ok(records.some((item) => item.title === 'Add React to your profile'));
});

test('regeneration removes recommendations that are no longer applicable', async (t) => {
  const obsolete = recommendationRecord({
    id: 'recommendation-obsolete',
    title: 'Old recommendation',
    type: 'course',
    skillId: 'skill-retired-test',
  });
  const records = setupRecommendationReconciliation(t, [obsolete]);

  await matchingService.generateRecommendations('student-profile-test-001');

  assert.equal(records.some((item) => item.id === obsolete.id), false);
});

test('regeneration deduplicates existing and generated recommendations', async (t) => {
  const duplicateIncomplete = recommendationRecord({
    id: 'recommendation-sql-incomplete',
    title: 'Add SQL to your profile',
    skillId: 'skill-sql-test',
  });
  const duplicateCompleted = recommendationRecord({
    id: 'recommendation-sql-completed',
    title: 'Add SQL to your profile',
    skillId: 'skill-sql-test',
    isCompleted: true,
  });
  const records = setupRecommendationReconciliation(t, [duplicateIncomplete, duplicateCompleted]);

  await matchingService.generateRecommendations('student-profile-test-001');

  const matching = records.filter((item) => item.title === 'Add SQL to your profile');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, duplicateCompleted.id);
  assert.equal(matching[0].isCompleted, true);

  const reconciledCount = records.length;
  await matchingService.generateRecommendations('student-profile-test-001');
  assert.equal(records.length, reconciledCount);
});