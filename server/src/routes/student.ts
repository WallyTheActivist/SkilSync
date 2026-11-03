import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar as uploadAvatarController,
  getReadinessScore,
  getSkillGapAnalysis,
  getRecommendations,
  markRecommendationComplete,
} from '../controllers/studentController';
import { authenticate, authorize } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';
import { idParam, optionalHttpUrl, optionalInstitutionName, optionalNumber, optionalPersonName, optionalRequiredText, optionalText, validateRequest } from '../middleware/validation';import { body } from 'express-validator';

const router = Router();

router.use(authenticate);
router.use(authorize('STUDENT'));

router.get('/profile', getProfile);
router.put('/profile', [
  optionalPersonName('firstName', 'First name', 80),
  optionalPersonName('lastName', 'Last name', 80),
  optionalText('phone', 32),
  optionalInstitutionName('university', 160),
  optionalText('faculty', 160),
  optionalText('degree', 160),
  optionalNumber('yearOfStudy', 1, 20, true, true),
  optionalNumber('gpa', 0, 100, false, true),
  optionalText('bio', 4000),
  optionalHttpUrl('linkedIn'),
  optionalHttpUrl('github'),
  optionalHttpUrl('portfolioUrl'),
  optionalText('city', 120),
  optionalText('country', 120),
  body('country').optional().isString().withMessage('country must be a string.'),
  validateRequest,
], updateProfile);
router.post('/profile/avatar', uploadAvatar, uploadAvatarController);
router.get('/readiness-score', getReadinessScore);
router.get('/skill-gap', getSkillGapAnalysis);
router.get('/recommendations', getRecommendations);
router.patch('/recommendations/:id/complete', [idParam(), validateRequest], markRecommendationComplete);

export default router;
