import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import matchingService from '../services/matchingService';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        studentSkills: {
          include: { skill: true },
          orderBy: { skill: { name: 'asc' } },
        },
      },
    });

    if (!profile) return next(createError('Profile not found.', 404));

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const {
      firstName, lastName, phone, university, faculty,
      degree, yearOfStudy, gpa, bio, linkedIn, github,
      portfolioUrl, city, country,
    } = req.body;

    const profile = await prisma.studentProfile.update({
      where: { userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(university !== undefined && { university }),
        ...(faculty !== undefined && { faculty }),
        ...(degree !== undefined && { degree }),
        ...(yearOfStudy !== undefined && { yearOfStudy: yearOfStudy === null ? null : Number(yearOfStudy) }),
        ...(gpa !== undefined && { gpa: gpa === null ? null : Number(gpa) }),
        ...(bio !== undefined && { bio }),
        ...(linkedIn !== undefined && { linkedIn }),
        ...(github !== undefined && { github }),
        ...(portfolioUrl !== undefined && { portfolioUrl }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
      },
    });

    res.json({ success: true, message: 'Profile updated successfully.', data: profile });
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    if (!req.file) return next(createError('No image file provided.', 400));

    // Delete old avatar
    const existing = await prisma.studentProfile.findUnique({ where: { userId } });
    if (existing?.avatarUrl) {
      const oldPath = path.join(process.cwd(), existing.avatarUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `uploads/avatars/${req.file.filename}`;
    const profile = await prisma.studentProfile.update({
      where: { userId },
      data: { avatarUrl },
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully.',
      data: { avatarUrl: profile.avatarUrl },
    });
  } catch (err) {
    next(err);
  }
};

export const getReadinessScore = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: { studentSkills: { include: { skill: true } } },
    });
    if (!profile) return next(createError('Profile not found.', 404));

    const result = await matchingService.calculateReadinessScore(profile.id);

    // Persist overall score on the profile for quick access
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { readinessScore: result.overall },
    });

    res.json({ success: true, data: { readinessScore: result.overall, breakdown: result } });
  } catch (err) {
    next(err);
  }
};

export const getSkillGapAnalysis = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const analysis = await matchingService.getSkillGapAnalysis(profile.id);
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
};

export const getRecommendations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    // Regenerate recommendations
    await matchingService.generateRecommendations(profile.id);

    const recommendations = await prisma.recommendation.findMany({
      where: { studentProfileId: profile.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: recommendations });
  } catch (err) {
    next(err);
  }
};

export const markRecommendationComplete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const rec = await prisma.recommendation.findFirst({
      where: { id, studentProfileId: profile.id },
    });
    if (!rec) return next(createError('Recommendation not found.', 404));

    const updated = await prisma.recommendation.update({
      where: { id },
      data: { isCompleted: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
