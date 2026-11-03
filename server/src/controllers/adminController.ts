import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const isPrismaRecordNotFoundError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === 'P2025';

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
export const getStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalStudents,
      totalEmployers,
      totalInternships,
      activeInternships,
      totalApplications,
      totalSkills,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'EMPLOYER' } }),
      prisma.internship.count(),
      prisma.internship.count({ where: { status: 'ACTIVE' } }),
      prisma.application.count(),
      prisma.skill.count(),
    ]);

    const applicationsByStatus = await prisma.application.groupBy({
      by: ['status'],
      _count: true,
    });

    const internshipsByStatus = await prisma.internship.groupBy({
      by: ['status'],
      _count: true,
    });

    const recentRegistrations = await prisma.user.findMany({
      where: { role: { in: ['STUDENT', 'EMPLOYER'] } },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Top requested skills across all internship postings
    const rawTopSkills = await prisma.internshipSkill.groupBy({
      by: ['skillId'],
      _count: { skillId: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: 10,
    });
    const skillIds = rawTopSkills.map((s) => s.skillId);
    const skillDetails = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, name: true, category: true },
    });
    const skillDetailMap = new Map(skillDetails.map((s) => [s.id, s]));
    const topRequestedSkills = rawTopSkills.map((s) => ({
      skillId: s.skillId,
      skillName: skillDetailMap.get(s.skillId)?.name ?? 'Unknown',
      category: skillDetailMap.get(s.skillId)?.category ?? 'OTHER',
      count: s._count.skillId,
    }));

    // Readiness score distribution across student profiles
    const studentProfiles = await prisma.studentProfile.findMany({ select: { readinessScore: true } });
    const readinessDistribution = [
      { tier: 'Not Ready',    range: '0–49',   color: '#ef4444', count: studentProfiles.filter((p) => p.readinessScore < 50).length },
      { tier: 'Developing',   range: '50–69',  color: '#f59e0b', count: studentProfiles.filter((p) => p.readinessScore >= 50 && p.readinessScore < 70).length },
      { tier: 'Ready',        range: '70–84',  color: '#22c55e', count: studentProfiles.filter((p) => p.readinessScore >= 70 && p.readinessScore < 85).length },
      { tier: 'Highly Ready', range: '85–100', color: '#10b981', count: studentProfiles.filter((p) => p.readinessScore >= 85).length },
    ];

    res.json({
      success: true,
      data: {
        totalStudents,
        totalEmployers,
        totalInternships,
        activeInternships,
        totalApplications,
        totalSkills,
        applicationsByStatus,
        internshipsByStatus,
        recentRegistrations,
        topRequestedSkills,
        readinessDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/analytics ─────────────────────────────────────────────────────
export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Top internships by application count
    const topInternships = await prisma.internship.findMany({
      include: {
        employer: { select: { companyName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { applications: { _count: 'desc' } },
      take: 10,
    });

    // Top skills by student adoption
    const topSkills = await prisma.skill.findMany({
      include: { _count: { select: { studentSkills: true } } },
      orderBy: { studentSkills: { _count: 'desc' } },
      take: 10,
    });

    // Average match scores per internship
    const matchScores = await prisma.application.groupBy({
      by: ['internshipId'],
      _avg: { matchScore: true },
      _count: true,
    });

    // Applications over time (last 30 days) – group by day
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentApplications = await prisma.application.findMany({
      where: { appliedAt: { gte: thirtyDaysAgo } },
      select: { appliedAt: true },
      orderBy: { appliedAt: 'asc' },
    });

    // Bucket by day
    const appsByDay: Record<string, number> = {};
    recentApplications.forEach((a) => {
      const day = a.appliedAt.toISOString().split('T')[0];
      appsByDay[day] = (appsByDay[day] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        topInternships,
        topSkills,
        matchScores,
        applicationTrend: Object.entries(appsByDay).map(([date, count]) => ({ date, count })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/students ──────────────────────────────────────────────────────
export const getStudents = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { role: 'STUDENT' };
    if (search) {
      where.OR = [
        { email: { contains: String(search) } },
        { studentProfile: { firstName: { contains: String(search) } } },
        { studentProfile: { lastName: { contains: String(search) } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          studentProfile: {
            include: { _count: { select: { applications: true, studentSkills: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/employers ─────────────────────────────────────────────────────
export const getEmployers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { role: 'EMPLOYER' };
    if (search) {
      where.OR = [
        { email: { contains: String(search) } },
        { employerProfile: { companyName: { contains: String(search) } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          employerProfile: {
            include: { _count: { select: { internships: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────
export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return next(createError('User not found.', 404));
    if (user.role === 'ADMIN') return next(createError('Cannot delete admin accounts.', 403));

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/internships ───────────────────────────────────────────────────
export const getAllInternships = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { employer: { companyName: { contains: String(search) } } },
      ];
    }

    const [internships, total] = await Promise.all([
      prisma.internship.findMany({
        where,
        include: {
          employer: true,
          requiredSkills: { include: { skill: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.internship.count({ where }),
    ]);

    res.json({
      success: true,
      data: internships,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /admin/internships/:id ─────────────────────────────────────────────
export const updateInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, title, description } = req.body;
    const updated = await prisma.internship.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(title && { title }),
        ...(description && { description }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) {
      return next(createError('Internship not found.', 404));
    }
    next(err);
  }
};

// ─── DELETE /admin/internships/:id ────────────────────────────────────────────
export const deleteInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.internship.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Internship deleted.' });
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) {
      return next(createError('Internship not found.', 404));
    }
    next(err);
  }
};

// ─── GET /admin/applications ──────────────────────────────────────────────────
export const getAllApplications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          studentProfile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          internship: {
            select: { title: true, employer: { select: { companyName: true } } },
          },
        },
        orderBy: { appliedAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/skills ────────────────────────────────────────────────────────
export const getSkills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, category } = req.query;
    const where: Record<string, unknown> = {};
    if (category) where.category = String(category);
    if (search) where.name = { contains: String(search) };

    const skills = await prisma.skill.findMany({
      where,
      include: { _count: { select: { studentSkills: true, internshipSkills: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
};

// ─── POST /admin/skills ───────────────────────────────────────────────────────
export const createSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, category, description } = req.body;
    if (!name) return next(createError('Skill name is required.', 400));

    const existing = await prisma.skill.findUnique({ where: { name } });
    if (existing) return next(createError('A skill with this name already exists.', 409));

    const skill = await prisma.skill.create({
      data: { name, category: category || 'OTHER', description: description || null },
    });
    res.status(201).json({ success: true, data: skill });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /admin/skills/:id ────────────────────────────────────────────────────
export const updateSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, category, description } = req.body;
    const skill = await prisma.skill.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
      },
    });
    res.json({ success: true, data: skill });
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) {
      return next(createError('Skill not found.', 404));
    }
    next(err);
  }
};

// ─── DELETE /admin/skills/:id ─────────────────────────────────────────────────
export const deleteSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.skill.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Skill deleted.' });
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) {
      return next(createError('Skill not found.', 404));
    }
    next(err);
  }
};
