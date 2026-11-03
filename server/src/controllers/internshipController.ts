import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import matchingService from '../services/matchingService';

export const getAllInternships = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, industry, isRemote, page = '1', limit = '12' } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      ...(industry && { industry: { contains: String(industry) } }),
      ...(isRemote !== undefined && { isRemote: isRemote === 'true' }),
      ...(search && {
        OR: [
          { title: { contains: String(search) } },
          { description: { contains: String(search) } },
          { employer: { companyName: { contains: String(search) } } },
        ],
      }),
    };

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
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getInternshipById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const internship = await prisma.internship.findUnique({
      where: { id },
      include: {
        employer: true,
        requiredSkills: {
          include: { skill: true },
          orderBy: { importance: 'desc' },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!internship) return next(createError('Internship not found.', 404));

    res.json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
};

export const getRecommendedInternships = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const matches = await matchingService.getTopMatches(profile.id, 10);
    res.json({ success: true, data: matches });
  } catch (err) {
    next(err);
  }
};

export const getMatchScore = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { internshipId } = req.params;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const score = await matchingService.calculateMatchScore(profile.id, internshipId);
    res.json({ success: true, data: score });
  } catch (err) {
    next(err);
  }
};
