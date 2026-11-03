import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { canTransitionApplicationStatus } from '../utils/applicationStatus';

const isPrismaForeignKeyConstraintError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === 'P2003';

// ─── Helper: resolve employer profile ────────────────────────────────────────
async function resolveProfile(req: AuthRequest, next: NextFunction) {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!profile) {
    next(createError('Employer profile not found.', 404));
    return null;
  }
  return profile;
}

// ─── GET /employer/profile ────────────────────────────────────────────────────
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await prisma.employerProfile.findUnique({
      where: { userId: req.user!.userId },
      include: {
        _count: { select: { internships: true } },
      },
    });
    if (!profile) return next(createError('Employer profile not found.', 404));
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /employer/profile ────────────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { companyName, industry, website, description, city, country } = req.body;
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const updated = await prisma.employerProfile.update({
      where: { id: profile.id },
      data: {
        ...(companyName && { companyName }),
        ...(industry !== undefined && { industry }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(city !== undefined && { city }),
        ...(country && { country }),
      },
    });
    res.json({ success: true, message: 'Profile updated.', data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── POST /employer/profile/logo ──────────────────────────────────────────────
export const uploadLogo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) return next(createError('No file uploaded.', 400));
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const logoUrl = `/uploads/avatars/${req.file.filename}`;
    await prisma.employerProfile.update({ where: { id: profile.id }, data: { logoUrl } });
    res.json({ success: true, data: { logoUrl } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /employer/internships ────────────────────────────────────────────────
export const getMyInternships = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const { status, page = '1', limit = '10' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {
      employerProfileId: profile.id,
      ...(status && { status: String(status) }),
    };

    const [internships, total] = await Promise.all([
      prisma.internship.findMany({
        where,
        include: {
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

export const getMyInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const internship = await prisma.internship.findFirst({
      where: { id: req.params.id, employerProfileId: profile.id },
      include: {
        requiredSkills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!internship) return next(createError('Internship not found.', 404));

    res.json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
};

// ─── POST /employer/internships ───────────────────────────────────────────────
export const createInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const {
      title, description, responsibilities, requirements, location, isRemote,
      stipend, currency, durationMonths, startDate, applicationDeadline,
      status, industry, tags, skills = [],
    } = req.body;

    if (!title) return next(createError('Internship title is required.', 400));
    if (!description) return next(createError('Description is required.', 400));
    if (!durationMonths) return next(createError('Duration is required.', 400));
    if (!location && !isRemote) return next(createError('Location is required unless the internship is remote.', 400));
    if (!applicationDeadline) return next(createError('Application closing date is required.', 400));
    if (!Array.isArray(skills) || skills.length === 0) {
      return next(createError('At least one required skill must be specified.', 400));
    }

    const skillIds = skills.map((skill: { skillId: string }) => skill.skillId);
    const existingSkills = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true },
    });
    if (existingSkills.length !== skillIds.length) {
      return next(createError('One or more required skills do not exist.', 400));
    }

    const internship = await prisma.internship.create({
      data: {
        employerProfileId: profile.id,
        title,
        description,
        responsibilities: responsibilities || null,
        requirements: requirements || null,
        location: location || null,
        isRemote: Boolean(isRemote),
        stipend: stipend ? Number(stipend) : null,
        currency: currency || 'ZAR',
        durationMonths: durationMonths ? Number(durationMonths) : null,
        startDate: startDate ? new Date(startDate) : null,
        applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
        status: status || 'ACTIVE',
        industry: industry || null,
        tags: tags || null,
        requiredSkills: {
          create: skills.map((s: { skillId: string; importance: number; minimumLevel: string }) => ({
            skillId: s.skillId,
            importance: Number(s.importance) || 3,
            minimumLevel: s.minimumLevel || 'BEGINNER',
          })),
        },
      },
      include: {
        requiredSkills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    });

    res.status(201).json({ success: true, message: 'Internship posted.', data: internship });
  } catch (err) {
    if (isPrismaForeignKeyConstraintError(err)) {
      return next(createError('One or more referenced records no longer exist.', 400));
    }
    next(err);
  }
};

// ─── PUT /employer/internships/:id ────────────────────────────────────────────
export const updateInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const internship = await prisma.internship.findFirst({
      where: { id: req.params.id, employerProfileId: profile.id },
    });
    if (!internship) return next(createError('Internship not found.', 404));

    const {
      title, description, responsibilities, requirements, location, isRemote,
      stipend, currency, durationMonths, startDate, applicationDeadline,
      status, industry, tags, skills,
    } = req.body;

    if (Array.isArray(skills)) {
      const skillIds = skills.map((skill: { skillId: string }) => skill.skillId);
      const existingSkills = await prisma.skill.findMany({
        where: { id: { in: skillIds } },
        select: { id: true },
      });
      if (existingSkills.length !== skillIds.length) {
        return next(createError('One or more required skills do not exist.', 400));
      }
    }

    const full = await prisma.$transaction(async (transaction) => {
      await transaction.internship.update({
        where: { id: internship.id },
        data: {
          ...(title && { title }),
          ...(description && { description }),
          ...(responsibilities !== undefined && { responsibilities }),
          ...(requirements !== undefined && { requirements }),
          ...(location !== undefined && { location }),
          ...(isRemote !== undefined && { isRemote: Boolean(isRemote) }),
          ...(stipend !== undefined && { stipend: stipend ? Number(stipend) : null }),
          ...(currency && { currency }),
          ...(durationMonths !== undefined && { durationMonths: durationMonths ? Number(durationMonths) : null }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(applicationDeadline !== undefined && { applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null }),
          ...(status && { status }),
          ...(industry !== undefined && { industry }),
          ...(tags !== undefined && { tags }),
        },
      });

      if (Array.isArray(skills)) {
        await transaction.internshipSkill.deleteMany({ where: { internshipId: internship.id } });
        if (skills.length > 0) {
          await transaction.internshipSkill.createMany({
            data: skills.map((s: { skillId: string; importance: number; minimumLevel: string }) => ({
              internshipId: internship.id,
              skillId: s.skillId,
              importance: Number(s.importance) || 3,
              minimumLevel: s.minimumLevel || 'BEGINNER',
            })),
          });
        }
      }

      return transaction.internship.findUnique({
        where: { id: internship.id },
        include: { requiredSkills: { include: { skill: true } }, _count: { select: { applications: true } } },
      });
    });
    res.json({ success: true, message: 'Internship updated.', data: full });
  } catch (err) {
    if (isPrismaForeignKeyConstraintError(err)) {
      return next(createError('One or more referenced records no longer exist.', 400));
    }
    next(err);
  }
};

// ─── DELETE /employer/internships/:id ─────────────────────────────────────────
export const deleteInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const internship = await prisma.internship.findFirst({
      where: { id: req.params.id, employerProfileId: profile.id },
    });
    if (!internship) return next(createError('Internship not found.', 404));

    await prisma.internship.delete({ where: { id: internship.id } });
    res.json({ success: true, message: 'Internship deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /employer/internships/:id/applicants ─────────────────────────────────
export const getApplicants = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const internship = await prisma.internship.findFirst({
      where: { id: req.params.id, employerProfileId: profile.id },
    });
    if (!internship) return next(createError('Internship not found.', 404));

    const { status } = req.query;
    const where: Record<string, unknown> = {
      internshipId: internship.id,
      ...(status && { status: String(status) }),
    };

    const applications = await prisma.application.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            studentSkills: { include: { skill: true } },
          },
        },
      },
      orderBy: { matchScore: 'desc' },
    });

    res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /employer/applications/:id/status ─────────────────────────────────
export const updateApplicationStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { internship: true },
    });

    if (!application) return next(createError('Application not found.', 404));
    if (application.internship.employerProfileId !== profile.id) {
      return next(createError('Not authorized to update this application.', 403));
    }

    const { status, notes } = req.body;
    const validStatuses = ['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return next(createError('Invalid status value.', 400));
    }
    if (!canTransitionApplicationStatus(application.status, status)) {
      return next(createError(`Invalid application status transition from ${application.status} to ${status}.`, 409));
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: { status, ...(notes !== undefined && { notes }) },
      include: {
        studentProfile: true,
        internship: true,
      },
    });

    res.json({ success: true, message: 'Application status updated.', data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── GET /employer/dashboard/stats ────────────────────────────────────────────
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await resolveProfile(req, next);
    if (!profile) return;

    const [activeInternships, totalApplications, pendingApplications, shortlistedApplications] = await Promise.all([
      prisma.internship.count({ where: { employerProfileId: profile.id, status: 'ACTIVE' } }),
      prisma.application.count({ where: { internship: { employerProfileId: profile.id } } }),
      prisma.application.count({ where: { internship: { employerProfileId: profile.id }, status: 'PENDING' } }),
      prisma.application.count({ where: { internship: { employerProfileId: profile.id }, status: 'SHORTLISTED' } }),
    ]);

    const [recentApplications, topCandidates, applicationsByStatus] = await Promise.all([
      prisma.application.findMany({
        where: { internship: { employerProfileId: profile.id } },
        include: {
          studentProfile: true,
          internship: { select: { title: true } },
        },
        orderBy: { appliedAt: 'desc' },
        take: 5,
      }),
      // Top candidates ranked by match score
      prisma.application.findMany({
        where: { internship: { employerProfileId: profile.id }, status: { not: 'WITHDRAWN' } },
        include: {
          studentProfile: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, university: true, readinessScore: true } },
          internship: { select: { title: true } },
        },
        orderBy: { matchScore: 'desc' },
        take: 5,
      }),
      // Application breakdown by status (for hiring chart)
      prisma.application.groupBy({
        by: ['status'],
        where: { internship: { employerProfileId: profile.id } },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        activeInternships,
        totalApplications,
        pendingApplications,
        shortlistedApplications,
        recentApplications,
        topCandidates,
        applicationsByStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};
