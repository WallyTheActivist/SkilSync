import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const getAllSkills = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
};

export const getStudentSkills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const skills = await prisma.studentSkill.findMany({
      where: { studentProfileId: profile.id },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });

    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
};

export const addStudentSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const { skillId, proficiency = 'BEGINNER', yearsExperience } = req.body;
    if (!skillId) return next(createError('Skill ID is required.', 400));

    const validLevels = ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
    if (!validLevels.includes(proficiency)) {
      return next(createError('Invalid proficiency level.', 400));
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) return next(createError('Skill not found.', 404));

    const existing = await prisma.studentSkill.findUnique({
      where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId } },
    });
    if (existing) return next(createError('You have already added this skill.', 409));

    const studentSkill = await prisma.studentSkill.create({
      data: {
        studentProfileId: profile.id,
        skillId,
        proficiency,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      },
      include: { skill: true },
    });

    res.status(201).json({ success: true, message: 'Skill added successfully.', data: studentSkill });
  } catch (err) {
    next(err);
  }
};

export const updateStudentSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return next(createError('Unauthorized.', 401));

    const { proficiency, yearsExperience, certificationUrl } = req.body;

    const validLevels = ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
    if (proficiency && !validLevels.includes(proficiency)) {
      return next(createError('Invalid proficiency level.', 400));
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const existing = await prisma.studentSkill.findFirst({
      where: { id, studentProfileId: profile.id },
    });
    if (!existing) return next(createError('Skill not found in your profile.', 404));

    const updated = await prisma.studentSkill.update({
      where: { id },
      data: {
        ...(proficiency && { proficiency }),
        ...(yearsExperience !== undefined && { yearsExperience: Number(yearsExperience) }),
        ...(certificationUrl !== undefined && { certificationUrl }),
      },
      include: { skill: true },
    });

    res.json({ success: true, message: 'Skill updated successfully.', data: updated });
  } catch (err) {
    next(err);
  }
};

export const removeStudentSkill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return next(createError('Unauthorized.', 401));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return next(createError('Profile not found.', 404));

    const existing = await prisma.studentSkill.findFirst({
      where: { id, studentProfileId: profile.id },
    });
    if (!existing) return next(createError('Skill not found in your profile.', 404));

    await prisma.studentSkill.delete({ where: { id } });

    res.json({ success: true, message: 'Skill removed successfully.' });
  } catch (err) {
    next(err);
  }
};
