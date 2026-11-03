import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import {
  idParam, optionalEnum, optionalPagination, optionalQueryEnum, optionalQueryText,
  optionalRequiredText, optionalText, requiredText, validateRequest,
} from '../middleware/validation';
import {
  getStats, getAnalytics,
  getStudents, getEmployers, deleteUser,
  getAllInternships, updateInternship, deleteInternship,
  getAllApplications,
  getSkills, createSkill, updateSkill, deleteSkill,
} from '../controllers/adminController';

const router = Router();

// All routes require ADMIN auth
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getStats);
router.get('/analytics', getAnalytics);

router.get('/students', [optionalQueryText('search', 160), ...optionalPagination(), validateRequest], getStudents);
router.get('/employers', [optionalQueryText('search', 160), ...optionalPagination(), validateRequest], getEmployers);
router.delete('/users/:id', [idParam(), validateRequest], deleteUser);

router.get('/internships', [
  optionalQueryText('search', 160),
  optionalQueryEnum('status', ['DRAFT', 'ACTIVE', 'CLOSED', 'FILLED']),
  ...optionalPagination(),
  validateRequest,
], getAllInternships);
router.patch('/internships/:id', [
  idParam(),
  optionalEnum('status', ['DRAFT', 'ACTIVE', 'CLOSED', 'FILLED']),
  optionalText('title', 160),
  optionalText('description', 10000),
  validateRequest,
], updateInternship);
router.delete('/internships/:id', [idParam(), validateRequest], deleteInternship);

router.get('/applications', [
  optionalQueryEnum('status', ['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  ...optionalPagination(),
  validateRequest,
], getAllApplications);

router.get('/skills', [
  optionalQueryText('search', 100),
  optionalQueryEnum('category', ['PROGRAMMING', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'DESIGN', 'SOFT_SKILL', 'LANGUAGE', 'TOOL', 'OTHER']),
  validateRequest,
], getSkills);
router.post('/skills', [
  requiredText('name', 100),
  optionalEnum('category', ['PROGRAMMING', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'DESIGN', 'SOFT_SKILL', 'LANGUAGE', 'TOOL', 'OTHER']),
  optionalText('description', 1000),
  validateRequest,
], createSkill);
router.put('/skills/:id', [
  idParam(),
  optionalRequiredText('name', 100),
  optionalEnum('category', ['PROGRAMMING', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'DESIGN', 'SOFT_SKILL', 'LANGUAGE', 'TOOL', 'OTHER']),
  optionalText('description', 1000),
  validateRequest,
], updateSkill);
router.delete('/skills/:id', [idParam(), validateRequest], deleteSkill);

export default router;
