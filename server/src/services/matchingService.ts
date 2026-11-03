import crypto from 'crypto';
import prisma from '../config/database';

const PROFICIENCY_SCORES: Record<string, number> = {
  BEGINNER: 1,
  ELEMENTARY: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
  EXPERT: 5,
};

interface MatchScoreResult {
  overall: number | null;
  breakdown: {
    matched: MatchedSkill[];
    missing: MissingSkill[];
    bonus: BonusSkill[];
  };
  label: string;
  stats: {
    fullMatches: number;
    partialMatches: number;
    missingCount: number;
    earnedPoints: number;
    maxPoints: number;
  };
}

interface MatchedSkill {
  skillId: string;
  skillName: string;
  studentLevel: string;
  requiredLevel: string;
  matchType: 'full' | 'partial';  // full = student meets/exceeds, partial = student below required
  score: number;
  maxScore: number;
  pct: number; // 0-100 for that skill slot
}

interface MissingSkill {
  skillId: string;
  skillName: string;
  requiredLevel: string;
  importance: number;
}

interface BonusSkill {
  skillId: string;
  skillName: string;
  studentLevel: string;
}

interface SkillGap {
  skillId: string;
  skillName: string;
  skillCategory: string;
  requiredLevel: string;
  currentLevel: string | null;
  gap: number;
  internships: string[];
  frequency: number;
  gapType: 'missing' | 'weak'; // missing = student has no entry; weak = has skill but below required
}

interface RecommendedSkill {
  skillId: string;
  skillName: string;
  skillCategory: string;
  frequency: number;     // number of active internships requiring it
  suggestedLevel: string; // most commonly required level
}

interface SkillGapAnalysis {
  overallReadiness: number;
  totalSkillsOwned: number;
  topGaps: SkillGap[];           // all gaps, sorted by impact (backwards compat)
  missingSkills: SkillGap[];     // student has no entry for these skills
  weakSkills: SkillGap[];        // student has skill but below required level
  recommendedSkills: RecommendedSkill[]; // popular market skills student lacks
  strongSkills: StrongSkill[];
}

interface StrongSkill {
  skillId: string;
  skillName: string;
  level: string;
  applicableInternships: number;
}

interface ReadinessComponent {
  score: number;      // 0-100 for this component
  weight: number;     // percentage weight in formula
  rawValue: number;   // raw metric (skill count, avg level, etc.)
  label: string;      // human-readable detail
}

interface ReadinessResult {
  overall: number;
  label: string;
  components: {
    skillCount: ReadinessComponent;
    skillProficiency: ReadinessComponent;
    internshipCompatibility: ReadinessComponent;
    applicationHistory: ReadinessComponent;
  };
}

const getMatchLabel = (score: number): string => {
  if (score >= 85) return 'Excellent Match';
  if (score >= 70) return 'Strong Match';
  if (score >= 55) return 'Good Match';
  if (score >= 40) return 'Partial Match';
  if (score >= 25) return 'Weak Match';
  return 'Low Match';
};

const getProficiencyRank = (level: string | null | undefined): number => {
  const value = level ?? 'BEGINNER';
  return PROFICIENCY_SCORES[value] || 1;
};

const getHigherProficiency = (left: string, right: string): string => {
  return getProficiencyRank(left) >= getProficiencyRank(right) ? left : right;
};

const calculateMatchScore = async (studentProfileId: string, internshipId: string): Promise<MatchScoreResult> => {
  const [studentSkills, internshipSkills] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentProfileId },
      include: { skill: true },
      orderBy: [
        { skill: { name: 'asc' } },
        { id: 'asc' },
      ],
    }),
    prisma.internshipSkill.findMany({
      where: { internshipId },
      include: { skill: true },
      orderBy: [
        { skill: { name: 'asc' } },
        { id: 'asc' },
      ],
    }),
  ]);

  if (internshipSkills.length === 0) {
    return {
      overall: null,
      breakdown: { matched: [], missing: [], bonus: [] },
      label: 'Not enough information',
      stats: { fullMatches: 0, partialMatches: 0, missingCount: 0, earnedPoints: 0, maxPoints: 0 },
    };
  }

  const studentSkillMap = new Map(studentSkills.map((ss) => [ss.skillId, ss]));
  const internshipSkillSet = new Set(internshipSkills.map((is) => is.skillId));

  let totalWeightedScore = 0;
  let totalMaxScore = 0;
  const matched: MatchedSkill[] = [];
  const missing: MissingSkill[] = [];

  for (const reqSkill of internshipSkills) {
    // Max possible points for this skill = importance (1-5) × 5 proficiency levels
    const maxSkillScore = reqSkill.importance * 5;
    totalMaxScore += maxSkillScore;

    const studentHas = studentSkillMap.get(reqSkill.skillId);
    if (studentHas) {
      const studentScore = PROFICIENCY_SCORES[studentHas.proficiency] || 0;
      const requiredScore = PROFICIENCY_SCORES[reqSkill.minimumLevel] || 1;

      let earnedScore: number;
      let matchType: 'full' | 'partial';

      if (studentScore >= requiredScore) {
        // Full Match — student meets or exceeds requirement → full points
        earnedScore = maxSkillScore;
        matchType = 'full';
      } else {
        // Partial Match — student has skill but below requirement → proportional
        earnedScore = Math.round((studentScore / requiredScore) * maxSkillScore * 10) / 10;
        matchType = 'partial';
      }

      totalWeightedScore += earnedScore;
      matched.push({
        skillId: reqSkill.skillId,
        skillName: reqSkill.skill.name,
        studentLevel: studentHas.proficiency,
        requiredLevel: reqSkill.minimumLevel,
        matchType,
        score: earnedScore,
        maxScore: maxSkillScore,
        pct: Math.round((earnedScore / maxSkillScore) * 100),
      });
    } else {
      missing.push({
        skillId: reqSkill.skillId,
        skillName: reqSkill.skill.name,
        requiredLevel: reqSkill.minimumLevel,
        importance: reqSkill.importance,
      });
    }
  }

  // Bonus skills: student has skills not required (up to 3, worth 2pts each, max 6)
  const bonus: BonusSkill[] = studentSkills
    .filter((ss) => !internshipSkillSet.has(ss.skillId))
    .sort((a, b) => a.skill.name.localeCompare(b.skill.name) || a.skillId.localeCompare(b.skillId))
    .slice(0, 3)
    .map((ss) => ({
      skillId: ss.skillId,
      skillName: ss.skill.name,
      studentLevel: ss.proficiency,
    }));

  const rawScore = totalMaxScore > 0 ? (totalWeightedScore / totalMaxScore) * 100 : 0;
  const bonusPoints = Math.min(bonus.length * 2, 6);
  const overall = Math.min(Math.round(rawScore + bonusPoints), 100);

  const fullMatches = matched.filter((m) => m.matchType === 'full').length;
  const partialMatches = matched.filter((m) => m.matchType === 'partial').length;

  return {
    overall,
    breakdown: { matched, missing, bonus },
    label: getMatchLabel(overall),
    stats: {
      fullMatches,
      partialMatches,
      missingCount: missing.length,
      earnedPoints: Math.round(totalWeightedScore * 10) / 10,
      maxPoints: totalMaxScore,
    },
  };
};

const calculateReadinessScore = async (studentProfileId: string): Promise<ReadinessResult> => {
  const [studentSkills, activeInternships, applications] = await Promise.all([
    prisma.studentSkill.findMany({ where: { studentProfileId } }),
    prisma.internship.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: 20,
    }),
    prisma.application.findMany({ where: { studentProfileId } }),
  ]);

  // ─── Component 1: Skill Count (weight 20%) ──────────────────────────────
  // 0 skills = 0%, 5 = 50%, 10+ = 100%
  const skillCount = studentSkills.length;
  const skillCountScore = Math.min(Math.round((skillCount / 10) * 100), 100);

  // ─── Component 2: Skill Proficiency (weight 30%) ─────────────────────────
  // Average proficiency level (1–5) normalised to 0–100%
  let proficiencyScore = 0;
  let avgLevel = 0;
  if (skillCount > 0) {
    const totalLevel = studentSkills.reduce((sum, ss) => sum + (PROFICIENCY_SCORES[ss.proficiency] || 1), 0);
    avgLevel = totalLevel / skillCount;
    proficiencyScore = Math.round((avgLevel / 5) * 100);
  }

  // ─── Component 3: Internship Compatibility (weight 40%) ──────────────────
  // Average match score across up to 20 active internships
  let compatibilityScore = 0;
  let scoredInternshipCount = 0;
  if (activeInternships.length > 0) {
    const matchScores = await Promise.all(
      activeInternships.map((i) => calculateMatchScore(studentProfileId, i.id))
    );
    const scoredMatches = matchScores.filter((score): score is MatchScoreResult & { overall: number } =>
      score.overall !== null
    );
    if (scoredMatches.length > 0) {
      compatibilityScore = Math.round(
        scoredMatches.reduce((sum, score) => sum + score.overall, 0) / scoredMatches.length
      );
    }
    scoredInternshipCount = scoredMatches.length;
  }

  // ─── Component 4: Application History (weight 10%) ───────────────────────
  // 0 apps = 0%, each app adds 15% up to 60%; positive outcome adds 40%
  const appCount = applications.length;
  const hasPositiveOutcome = applications.some((a) =>
    ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED'].includes(a.status)
  );
  let applicationScore = Math.min(appCount * 15, 60);
  if (hasPositiveOutcome) applicationScore = Math.min(applicationScore + 40, 100);
  applicationScore = Math.round(applicationScore);

  // ─── Weighted Final Score ─────────────────────────────────────────────────
  const overall = Math.min(
    Math.round(
      skillCountScore       * 0.20 +
      proficiencyScore      * 0.30 +
      compatibilityScore    * 0.40 +
      applicationScore      * 0.10
    ),
    100
  );

  const readinessLabel =
    overall >= 85 ? 'Highly Ready' :
    overall >= 70 ? 'Ready' :
    overall >= 50 ? 'Developing' :
    'Not Ready';

  return {
    overall,
    label: readinessLabel,
    components: {
      skillCount: {
        score: skillCountScore,
        weight: 20,
        rawValue: skillCount,
        label: `${skillCount} skill${skillCount !== 1 ? 's' : ''} added`,
      },
      skillProficiency: {
        score: proficiencyScore,
        weight: 30,
        rawValue: Math.round(avgLevel * 10) / 10,
        label: skillCount > 0
          ? `Avg proficiency ${(Math.round(avgLevel * 10) / 10).toFixed(1)} / 5`
          : 'No skills added yet',
      },
      internshipCompatibility: {
        score: compatibilityScore,
        weight: 40,
        rawValue: scoredInternshipCount,
        label: scoredInternshipCount > 0
          ? `${compatibilityScore}% avg match across ${scoredInternshipCount} listing${scoredInternshipCount !== 1 ? 's' : ''}`
          : activeInternships.length > 0
            ? 'No active listings with required skills'
            : 'No active internship listings',
      },
      applicationHistory: {
        score: applicationScore,
        weight: 10,
        rawValue: appCount,
        label: appCount === 0
          ? 'No applications submitted yet'
          : `${appCount} application${appCount !== 1 ? 's' : ''}${hasPositiveOutcome ? ' · positive outcome ✓' : ''}`,
      },
    },
  };
};

const getTopMatches = async (studentProfileId: string, limit = 10) => {
  const internships = await prisma.internship.findMany({
    where: { status: 'ACTIVE' },
    include: {
      employer: true,
      requiredSkills: { include: { skill: true }, orderBy: { importance: 'desc' } },
      _count: { select: { applications: true } },
    },
  });

  const scored = await Promise.all(
    internships.map(async (internship) => {
      const scoreResult = await calculateMatchScore(studentProfileId, internship.id);
      return { ...internship, matchScore: scoreResult.overall, matchLabel: scoreResult.label };
    })
  );

  return scored.sort((a, b) => {
    if (a.matchScore === null) {
      return b.matchScore === null
        ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
        : 1;
    }
    if (b.matchScore === null) return -1;
    return b.matchScore - a.matchScore || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  }).slice(0, limit);
};

const getSkillGapAnalysis = async (studentProfileId: string): Promise<SkillGapAnalysis> => {
  const [studentSkills, internships] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentProfileId },
      include: { skill: true },
    }),
    prisma.internship.findMany({
      where: { status: 'ACTIVE' },
      include: {
        requiredSkills: { include: { skill: true } },
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    }),
  ]);

  const studentSkillMap = new Map(studentSkills.map((ss) => [ss.skillId, ss]));
  const studentSkillIds = new Set(studentSkills.map((ss) => ss.skillId));
  const requirementMap = new Map<string, {
    skillId: string;
    skillName: string;
    skillCategory: string;
    requiredLevel: string;
    internships: string[];
    frequency: number;
  }>();

  for (const internship of internships) {
    for (const reqSkill of internship.requiredSkills) {
      const existing = requirementMap.get(reqSkill.skillId);
      const nextRequiredLevel = existing
        ? getHigherProficiency(existing.requiredLevel, reqSkill.minimumLevel)
        : reqSkill.minimumLevel;

      if (existing) {
        existing.requiredLevel = nextRequiredLevel;
        existing.frequency += 1;
        if (!existing.internships.includes(internship.title)) {
          existing.internships.push(internship.title);
        }
      } else {
        requirementMap.set(reqSkill.skillId, {
          skillId: reqSkill.skillId,
          skillName: reqSkill.skill.name,
          skillCategory: reqSkill.skill.category,
          requiredLevel: reqSkill.minimumLevel,
          internships: [internship.title],
          frequency: 1,
        });
      }
    }
  }

  const gapMap = new Map<string, SkillGap>();
  for (const req of requirementMap.values()) {
    const studentHas = studentSkillMap.get(req.skillId);
    const studentScore = studentHas ? getProficiencyRank(studentHas.proficiency) : 0;
    const requiredScore = getProficiencyRank(req.requiredLevel);
    const gap = Math.max(0, requiredScore - studentScore);

    if (gap > 0 || !studentHas) {
      const gapType: 'missing' | 'weak' = studentHas ? 'weak' : 'missing';
      gapMap.set(req.skillId, {
        skillId: req.skillId,
        skillName: req.skillName,
        skillCategory: req.skillCategory,
        requiredLevel: req.requiredLevel,
        currentLevel: studentHas?.proficiency || null,
        gap,
        gapType,
        internships: req.internships,
        frequency: req.frequency,
      });
    }
  }

  const topGaps = Array.from(gapMap.values())
    .sort((a, b) => b.frequency * b.gap - a.frequency * a.gap || a.skillName.localeCompare(b.skillName))
    .slice(0, 10);

  const missingSkills = topGaps.filter((g) => g.gapType === 'missing');
  const weakSkills = topGaps.filter((g) => g.gapType === 'weak');

  // Recommended skills: popular market skills the student hasn't added yet
  // (includes missing skills but also any other high-frequency skill the student lacks)
  const skillFreqMap = new Map<string, { skillId: string; skillName: string; skillCategory: string; frequency: number; levels: string[] }>();
  for (const internship of internships) {
    for (const rs of internship.requiredSkills) {
      if (!studentSkillIds.has(rs.skillId)) {
        const ex = skillFreqMap.get(rs.skillId);
        if (ex) {
          ex.frequency++;
          ex.levels.push(rs.minimumLevel);
        } else {
          skillFreqMap.set(rs.skillId, {
            skillId: rs.skillId,
            skillName: rs.skill.name,
            skillCategory: rs.skill.category,
            frequency: 1,
            levels: [rs.minimumLevel],
          });
        }
      }
    }
  }

  // Pick the level that appears most often as the suggested target
  const getMostCommonLevel = (levels: string[]): string => {
    const freq: Record<string, number> = {};
    for (const l of levels) freq[l] = (freq[l] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INTERMEDIATE';
  };

  const recommendedSkills: RecommendedSkill[] = Array.from(skillFreqMap.values())
    .sort((a, b) => b.frequency - a.frequency || a.skillName.localeCompare(b.skillName))
    .slice(0, 6)
    .map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      skillCategory: s.skillCategory,
      frequency: s.frequency,
      suggestedLevel: getMostCommonLevel(s.levels),
    }));

  // Strong skills (student has ≥ Intermediate and are relevant in market)
  const internshipSkillFreq = new Map<string, number>();
  for (const internship of internships) {
    for (const rs of internship.requiredSkills) {
      internshipSkillFreq.set(rs.skillId, (internshipSkillFreq.get(rs.skillId) || 0) + 1);
    }
  }

  const strongSkills: StrongSkill[] = studentSkills
    .filter((ss) => PROFICIENCY_SCORES[ss.proficiency] >= 3)
    .map((ss) => ({
      skillId: ss.skillId,
      skillName: ss.skill.name,
      level: ss.proficiency,
      applicableInternships: internshipSkillFreq.get(ss.skillId) || 0,
    }))
    .sort((a, b) => b.applicableInternships - a.applicableInternships || a.skillName.localeCompare(b.skillName))
    .slice(0, 8);

  const readinessResult = await calculateReadinessScore(studentProfileId);

  return {
    overallReadiness: readinessResult.overall,
    totalSkillsOwned: studentSkills.length,
    topGaps,
    missingSkills,
    weakSkills,
    recommendedSkills,
    strongSkills,
  };
};

const recommendationIdentity = (recommendation: {
  type: string;
  skillId?: string | null;
  title: string;
}): string => JSON.stringify([
  recommendation.type,
  recommendation.skillId ?? null,
  recommendation.title,
]);

const recommendationId = (studentProfileId: string, identity: string): string =>
  `rec_${crypto.createHash('sha256').update(`${studentProfileId}:${identity}`).digest('hex')}`;

const generateRecommendations = async (studentProfileId: string): Promise<void> => {
  const analysis = await getSkillGapAnalysis(studentProfileId);

  const LEVEL_LABELS: Record<string, string> = {
    BEGINNER: 'Beginner', ELEMENTARY: 'Basic',
    INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', EXPERT: 'Expert',
  };

  // ─── Course map (rule-based, no ML) ────────────────────────────────────────
  const courseMap: Record<string, { title: string; url: string }> = {
    JavaScript: { title: 'The Complete JavaScript Course', url: 'https://www.udemy.com/course/the-complete-javascript-course/' },
    TypeScript: { title: 'Understanding TypeScript', url: 'https://www.udemy.com/course/understanding-typescript/' },
    Python: { title: 'Python Bootcamp: From Zero to Hero', url: 'https://www.udemy.com/course/complete-python-bootcamp/' },
    Java: { title: 'Java Programming Masterclass', url: 'https://www.udemy.com/course/java-the-complete-java-developer-course/' },
    'C++': { title: 'Beginning C++ Programming', url: 'https://www.udemy.com/course/beginning-c-plus-plus-programming/' },
    'C#': { title: 'Complete C# Masterclass', url: 'https://www.udemy.com/course/complete-csharp-masterclass/' },
    React: { title: 'React – The Complete Guide', url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/' },
    'Node.js': { title: 'Node.js Developer Course', url: 'https://www.udemy.com/course/the-complete-nodejs-developer-course-2/' },
    Angular: { title: 'Angular – The Complete Guide', url: 'https://www.udemy.com/course/the-complete-guide-to-angular-2/' },
    'Vue.js': { title: 'Vue – The Complete Guide', url: 'https://www.udemy.com/course/vuejs-2-the-complete-guide/' },
    Django: { title: 'Django REST Framework API', url: 'https://www.udemy.com/course/django-rest-framework/' },
    SQL: { title: 'The Complete SQL Bootcamp', url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/' },
    MySQL: { title: 'MySQL Bootcamp', url: 'https://www.udemy.com/course/the-ultimate-mysql-bootcamp-go-from-sql-beginner-to-expert/' },
    PostgreSQL: { title: 'PostgreSQL Bootcamp', url: 'https://www.udemy.com/course/postgresqlmasterclass/' },
    MongoDB: { title: 'MongoDB – The Complete Guide', url: 'https://www.udemy.com/course/mongodb-the-complete-developers-guide/' },
    Docker: { title: 'Docker & Kubernetes: The Complete Guide', url: 'https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/' },
    Kubernetes: { title: 'Kubernetes for Beginners', url: 'https://www.udemy.com/course/learn-kubernetes/' },
    AWS: { title: 'AWS Certified Developer Associate', url: 'https://aws.amazon.com/certification/certified-developer-associate/' },
    Azure: { title: 'AZ-900 Azure Fundamentals', url: 'https://learn.microsoft.com/en-us/certifications/azure-fundamentals/' },
    'Google Cloud': { title: 'Google Cloud Digital Leader', url: 'https://cloud.google.com/certification/cloud-digital-leader' },
    'Cloud Computing': { title: 'Cloud Computing Fundamentals', url: 'https://www.coursera.org/learn/cloud-computing' },
    'Machine Learning': { title: 'Machine Learning A-Z', url: 'https://www.udemy.com/course/machinelearning/' },
    'Data Analysis': { title: 'Data Analysis with Python – freeCodeCamp', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/' },
    'Web Development': { title: 'The Complete Web Developer Bootcamp', url: 'https://www.udemy.com/course/the-complete-web-development-bootcamp/' },
    Cybersecurity: { title: 'CompTIA Security+ Certification', url: 'https://www.comptia.org/certifications/security' },
    Networking: { title: 'CompTIA Network+ Certification', url: 'https://www.comptia.org/certifications/network' },
    Git: { title: 'Git & GitHub Crash Course', url: 'https://www.udemy.com/course/git-and-github-bootcamp/' },
    Linux: { title: 'Linux Command Line Basics', url: 'https://www.udemy.com/course/linux-command-line-volume1/' },
    'UI/UX Design': { title: 'UI/UX Design Bootcamp', url: 'https://www.udemy.com/course/ui-ux-web-design-using-adobe-xd/' },
    TailwindCSS: { title: 'Tailwind CSS From Scratch', url: 'https://www.udemy.com/course/tailwind-from-scratch/' },
    'REST API': { title: 'REST API Design, Development & Management', url: 'https://www.udemy.com/course/rest-api/' },
    GraphQL: { title: 'GraphQL with React', url: 'https://www.udemy.com/course/graphql-with-react-course/' },
  };

  // ─── Certification map (rule-based) ────────────────────────────────────────
  const certMap: Record<string, { title: string; url: string }> = {
    Cybersecurity: { title: 'CompTIA Security+ SY0-701', url: 'https://www.comptia.org/certifications/security' },
    Networking: { title: 'CompTIA Network+ N10-009', url: 'https://www.comptia.org/certifications/network' },
    'Cloud Computing': { title: 'AWS Cloud Practitioner', url: 'https://aws.amazon.com/certification/certified-cloud-practitioner/' },
    AWS: { title: 'AWS Solutions Architect Associate', url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/' },
    Azure: { title: 'Microsoft AZ-900 Azure Fundamentals', url: 'https://learn.microsoft.com/en-us/certifications/azure-fundamentals/' },
    'Machine Learning': { title: 'TensorFlow Developer Certificate', url: 'https://www.tensorflow.org/certificate' },
    'Data Analysis': { title: 'Google Data Analytics Certificate', url: 'https://grow.google/certificates/data-analytics/' },
    Python: { title: 'PCEP – Certified Entry-Level Python Programmer', url: 'https://pythoninstitute.org/pcep' },
  };

  const recommendations: {
    studentProfileId: string;
    type: string;
    title: string;
    description: string;
    resourceUrl?: string;
    priority: number;
    skillId?: string;
  }[] = [];

  // ─── Rule 1: Weak skills — proficiency needs improvement ────────────────────
  for (const gap of analysis.weakSkills.slice(0, 5)) {
    const current = LEVEL_LABELS[gap.currentLevel!] ?? gap.currentLevel;
    const required = LEVEL_LABELS[gap.requiredLevel] ?? gap.requiredLevel;
    const gapSize = gap.gap;
    const urgency = gap.frequency >= 3 ? 'urgently' : gap.frequency >= 2 ? 'significantly' : '';

    recommendations.push({
      studentProfileId,
      type: 'skill_gap',
      title: `${gap.skillName} proficiency needs improvement`,
      description: `Your ${gap.skillName} is at ${current} level, but ${gap.frequency} internship${gap.frequency > 1 ? 's' : ''} require${gap.frequency === 1 ? 's' : ''} at least ${required}. ${urgency ? `This ${urgency} impacts your match scores.` : `Improving this would boost your match scores.`}`,
      priority: gapSize >= 3 ? 3 : gapSize >= 2 ? 3 : 2,
      skillId: gap.skillId,
    });
  }

  // ─── Rule 2: Missing skills — not in profile at all ─────────────────────────
  for (const gap of analysis.missingSkills.slice(0, 5)) {
    const required = LEVEL_LABELS[gap.requiredLevel] ?? gap.requiredLevel;

    recommendations.push({
      studentProfileId,
      type: 'skill_gap',
      title: `Add ${gap.skillName} to your profile`,
      description: `${gap.skillName} is required by ${gap.frequency} active internship${gap.frequency > 1 ? 's' : ''} at ${required} level, but it is not in your profile. Adding it will directly improve your match scores.`,
      priority: gap.frequency >= 3 ? 3 : gap.frequency >= 2 ? 2 : 1,
      skillId: gap.skillId,
    });
  }

  // ─── Rule 3: Course recommendations for top gaps ─────────────────────────────
  const coveredCourseSkills = new Set<string>();
  for (const gap of [...analysis.weakSkills, ...analysis.missingSkills].slice(0, 4)) {
    const course = courseMap[gap.skillName];
    if (course && !coveredCourseSkills.has(gap.skillId)) {
      coveredCourseSkills.add(gap.skillId);
      recommendations.push({
        studentProfileId,
        type: 'course',
        title: `Course: ${course.title}`,
        description: `Enrol in this course to ${gap.gapType === 'weak' ? `improve your ${gap.skillName} from ${LEVEL_LABELS[gap.currentLevel!]} to ${LEVEL_LABELS[gap.requiredLevel]}` : `gain ${gap.skillName} skills required by ${gap.frequency} internship${gap.frequency > 1 ? 's' : ''}`}.`,
        resourceUrl: course.url,
        priority: 2,
        skillId: gap.skillId,
      });
    }
  }

  // ─── Rule 4: Certification recommendations ───────────────────────────────────
  for (const gap of analysis.missingSkills.slice(0, 3)) {
    const cert = certMap[gap.skillName];
    if (cert) {
      recommendations.push({
        studentProfileId,
        type: 'certification',
        title: `Certification: ${cert.title}`,
        description: `Earning the ${cert.title} certification would validate your ${gap.skillName} skills and make you stand out to employers.`,
        resourceUrl: cert.url,
        priority: gap.frequency >= 2 ? 3 : 2,
        skillId: gap.skillId,
      });
    }
  }

  // ─── Rule 5: Recommended skills to add (popular in market) ───────────────────
  for (const rec of analysis.recommendedSkills.slice(0, 3)) {
    // Skip if already covered as a gap recommendation
    if (recommendations.some((r) => r.skillId === rec.skillId)) continue;
    const level = LEVEL_LABELS[rec.suggestedLevel] ?? rec.suggestedLevel;
    recommendations.push({
      studentProfileId,
      type: 'skill_gap',
      title: `Learn ${rec.skillName}`,
      description: `${rec.skillName} is requested by ${rec.frequency} employer${rec.frequency > 1 ? 's' : ''} in active listings (target: ${level} level). Adding it would broaden your internship opportunities.`,
      priority: rec.frequency >= 3 ? 2 : 1,
      skillId: rec.skillId,
    });
  }

  // ─── Rule 6: Apply encouragement (readiness-based) ───────────────────────────
  if (analysis.overallReadiness < 50) {
    recommendations.push({
      studentProfileId,
      type: 'skill_gap',
      title: 'Build a Stronger Skill Foundation',
      description: `Your readiness score is ${analysis.overallReadiness}%. Focus on adding the most-demanded missing skills and improving weak ones to unlock more internship matches.`,
      priority: 3,
    });
  } else if (analysis.overallReadiness >= 70) {
    recommendations.push({
      studentProfileId,
      type: 'internship',
      title: 'You Are Ready to Apply!',
      description: `Your readiness score of ${analysis.overallReadiness}% is strong. Visit the Matches page to apply for your top-ranked internships.`,
      priority: 2,
    });
  }

  const desiredByIdentity = new Map<string, (typeof recommendations)[number]>();
  for (const recommendation of recommendations) {
    const identity = recommendationIdentity(recommendation);
    if (!desiredByIdentity.has(identity)) desiredByIdentity.set(identity, recommendation);
  }

  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.recommendation.findMany({
      where: { studentProfileId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const existingByIdentity = new Map<string, typeof existing>();
    for (const recommendation of existing) {
      const identity = recommendationIdentity(recommendation);
      const matches = existingByIdentity.get(identity) ?? [];
      matches.push(recommendation);
      existingByIdentity.set(identity, matches);
    }

    const retainedIds = new Set<string>();
    for (const [identity, recommendation] of desiredByIdentity) {
      const matches = existingByIdentity.get(identity) ?? [];
      const retained = matches.find((match) => match.isCompleted) ?? matches[0];
      const id = retained?.id ?? recommendationId(studentProfileId, identity);

      await transaction.recommendation.upsert({
        where: { id },
        create: { id, ...recommendation },
        update: {
          type: recommendation.type,
          title: recommendation.title,
          description: recommendation.description,
          resourceUrl: recommendation.resourceUrl ?? null,
          priority: recommendation.priority,
          skillId: recommendation.skillId ?? null,
        },
      });
      retainedIds.add(id);
    }

    const obsoleteIds = existing
      .filter((recommendation) => !retainedIds.has(recommendation.id))
      .map((recommendation) => recommendation.id);

    if (obsoleteIds.length > 0) {
      await transaction.recommendation.deleteMany({ where: { id: { in: obsoleteIds } } });
    }
  });
};

export default {
  calculateMatchScore,
  calculateReadinessScore,
  getTopMatches,
  getSkillGapAnalysis,
  generateRecommendations,
};
