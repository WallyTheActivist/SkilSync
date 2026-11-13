import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';
import {
  idParam, optionalBoolean, optionalEnum, optionalHttpUrl, optionalIsoDate,
  optionalNumber, optionalPagination, optionalQueryEnum, optionalText,
  optionalRequiredText, requiredNumber, requiredText, validateRequest,
} from '../middleware/validation';
import {
  getProfile, updateProfile, uploadLogo,
  getMyInternships, getMyInternship, createInternship, updateInternship, deleteInternship,
  getApplicants, updateApplicationStatus, closeApplication, getDashboardStats,
} from '../controllers/employerController';

const router = Router();

const uniqueSkillRequirements = (optional = false) => {
  const validator = body('skills').custom((skills: unknown) => {
    if (!Array.isArray(skills)) return true;

    const skillIds = skills
      .map((skill: unknown) => (
        typeof skill === 'object'
        && skill !== null
        && 'skillId' in skill
        && typeof skill.skillId === 'string'
          ? skill.skillId.trim()
          : null
      ))
      .filter((skillId): skillId is string => skillId !== null);

    return new Set(skillIds).size === skillIds.length;
  }).withMessage('Each required skill can only be selected once.');

  return optional ? validator.optional({ values: 'null' }) : validator;
};

// All routes require EMPLOYER auth
router.use(authenticate, authorize('EMPLOYER'));

router.get('/dashboard/stats', getDashboardStats);
router.get('/profile', getProfile);
router.put('/profile', [
  optionalRequiredText('companyName', 160),
  optionalText('industry', 100),
  optionalHttpUrl('website'),
  optionalText('description', 4000),
  optionalText('city', 120),
  optionalText('country', 120),
  validateRequest,
], updateProfile);
router.post('/profile/logo', uploadAvatar, uploadLogo);

router.get('/internships', [
  optionalQueryEnum('status', ['DRAFT', 'ACTIVE', 'CLOSED', 'FILLED']),
  ...optionalPagination(),
  validateRequest,
], getMyInternships);
router.get('/internships/:id', [idParam(), validateRequest], getMyInternship);
router.post('/internships', [
  requiredText('title', 160),
  requiredText('description', 10000),
  optionalText('responsibilities', 5000),
  optionalText('requirements', 5000),
  optionalText('location', 160),
  optionalBoolean('isRemote'),
  optionalNumber('stipend', 0, 100000000),
  optionalEnum('currency', ['ZAR', 'USD', 'EUR']),
  requiredNumber('durationMonths', 1, 120, true),
  optionalIsoDate('startDate'),
  body('applicationDeadline').isISO8601({ strict: true, strictSeparator: true }).withMessage('applicationDeadline must be a valid ISO 8601 date.'),
  optionalEnum('status', ['DRAFT', 'ACTIVE', 'CLOSED', 'FILLED']),
  optionalText('industry', 100),
  optionalText('tags', 500),
  body('skills').isArray({ min: 1, max: 50 }).withMessage('skills must contain between 1 and 50 items.'),
  uniqueSkillRequirements(),
  body('skills.*').isObject().withMessage('Each skill must be an object.'),
  body('skills.*.skillId').isString().trim().isLength({ min: 1, max: 128 }).withMessage('Each skill requires a valid skillId.'),
  body('skills.*.importance').optional().custom((value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5).withMessage('Skill importance must be an integer from 1 to 5.'),
  body('skills.*.minimumLevel').optional().isIn(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).withMessage('Each skill minimumLevel is invalid.'),
  validateRequest,
], createInternship);
router.put('/internships/:id', [
  idParam(),
  optionalText('title', 160),
  optionalText('description', 10000),
  optionalText('responsibilities', 5000),
  optionalText('requirements', 5000),
  optionalText('location', 160),
  optionalBoolean('isRemote'),
  optionalNumber('stipend', 0, 100000000),
  optionalEnum('currency', ['ZAR', 'USD', 'EUR']),
  optionalNumber('durationMonths', 1, 120, true),
  optionalIsoDate('startDate'),
  optionalIsoDate('applicationDeadline'),
  optionalEnum('status', ['DRAFT', 'ACTIVE', 'CLOSED', 'FILLED']),
  optionalText('industry', 100),
  optionalText('tags', 500),
  body('skills').optional({ values: 'null' }).isArray({ min: 1, max: 50 }).withMessage('skills must contain between 1 and 50 items.'),
  uniqueSkillRequirements(true),
  body('skills.*').optional().isObject().withMessage('Each skill must be an object.'),
  body('skills.*.skillId').isString().withMessage('Each skill requires a valid skillId.').bail().trim().isLength({ min: 1, max: 128 }).withMessage('Each skill requires a valid skillId.'),
  body('skills.*.importance').optional().custom((value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5).withMessage('Skill importance must be an integer from 1 to 5.'),
  body('skills.*.minimumLevel').optional().isIn(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).withMessage('Each skill minimumLevel is invalid.'),
  validateRequest,
], updateInternship);
router.delete('/internships/:id', [idParam(), validateRequest], deleteInternship);
router.get('/internships/:id/applicants', [
  idParam(),
  optionalQueryEnum('status', ['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  optionalQueryEnum('lifecycle', ['open', 'closed']),
  validateRequest,
], getApplicants);

router.patch('/applications/:id/close', [idParam(), validateRequest], closeApplication);
router.patch('/applications/:id/status', [
  idParam(),
  body('status').isIn(['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED']).withMessage('status is invalid.'),
  optionalText('notes', 2000),
  validateRequest,
], updateApplicationStatus);

export default router;
