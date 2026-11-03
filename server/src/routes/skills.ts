import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllSkills,
  getStudentSkills,
  addStudentSkill,
  updateStudentSkill,
  removeStudentSkill,
} from '../controllers/skillController';
import { authenticate, authorize } from '../middleware/auth';
import { idParam, optionalEnum, optionalNumber, optionalHttpUrl, requiredText, validateRequest } from '../middleware/validation';

const router = Router();

// Public — get all available skills
router.get('/', getAllSkills);

// Student routes
router.get('/my-skills', authenticate, authorize('STUDENT'), getStudentSkills);
router.post('/my-skills', authenticate, authorize('STUDENT'), [
  requiredText('skillId', 128),
  optionalEnum('proficiency', ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  optionalNumber('yearsExperience', 0, 80),
  validateRequest,
], addStudentSkill);
router.put('/my-skills/:id', authenticate, authorize('STUDENT'), [
  idParam(),
  body().custom((_value, { req }) =>
    ['proficiency', 'yearsExperience', 'certificationUrl'].some((field) =>
      Object.prototype.hasOwnProperty.call(req.body ?? {}, field)
    )
  ).withMessage('At least one skill field must be provided.'),
  optionalEnum('proficiency', ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  optionalNumber('yearsExperience', 0, 80),
  optionalHttpUrl('certificationUrl'),
  validateRequest,
], updateStudentSkill);
router.delete('/my-skills/:id', authenticate, authorize('STUDENT'), [idParam(), validateRequest], removeStudentSkill);

export default router;
