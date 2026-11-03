import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import matchingService from '../services/matchingService';
import { canTransitionApplicationStatus } from '../utils/applicationStatus';

const isPrismaUniqueConstraintError = (err: unknown): boolean => {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
};

export const applyForInternship = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const { internshipId, coverLetter } = req.body;
    if (!internshipId) return next(createError('Internship ID is required.', 400));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const internship = await prisma.internship.findUnique({ where: { id: internshipId } });
    if (!internship) return next(createError('Internship not found.', 404));
    if (internship.status !== 'ACTIVE') return next(createError('This internship is no longer accepting applications.', 400));

    const existing = await prisma.application.findUnique({
      where: { studentProfileId_internshipId: { studentProfileId: profile.id, internshipId } },
    });
    if (existing) return next(createError('You have already applied for this internship.', 409));

    const matchScore = await matchingService.calculateMatchScore(profile.id, internshipId);

    try {
      const application = await prisma.application.create({
        data: {
          studentProfileId: profile.id,
          internshipId,
          coverLetter,
          matchScore: matchScore.overall,
        },
        include: {
          internship: {
            include: { employer: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully.',
        data: application,
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        return next(createError('You have already applied for this internship.', 409));
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

export const getMyApplications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const applications = await prisma.application.findMany({
      where: { studentProfileId: profile.id },
      include: {
        internship: {
          include: {
            employer: true,
            requiredSkills: { include: { skill: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
};

export const getMyApplicationsDashboard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const where = { studentProfileId: profile.id };
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          internship: {
            include: {
              employer: true,
              requiredSkills: { include: { skill: true } },
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
        take: 3,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({ success: true, data: { applications, total } });
  } catch (err) {
    next(err);
  }
};

export const withdrawApplication = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const application = await prisma.application.findFirst({
      where: { id, studentProfileId: profile.id },
    });
    if (!application) return next(createError('Application not found.', 404));

    if (!canTransitionApplicationStatus(application.status, 'WITHDRAWN')) {
      return next(createError('This application cannot be withdrawn.', 409));
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });

    res.json({ success: true, message: 'Application withdrawn.', data: updated });
  } catch (err) {
    next(err);
  }
};
