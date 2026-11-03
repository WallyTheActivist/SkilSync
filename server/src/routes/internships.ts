import { Router } from 'express';
import {
  getAllInternships,
  getInternshipById,
  getRecommendedInternships,
  getMatchScore,
} from '../controllers/internshipController';
import { authenticate, authorize } from '../middleware/auth';
import { idParam, optionalPagination, optionalQueryEnum, optionalQueryText, validateRequest } from '../middleware/validation';

const router = Router();

router.get('/', [
  optionalQueryText('search', 120),
  optionalQueryText('industry', 100),
  optionalQueryEnum('isRemote', ['true', 'false']),
  ...optionalPagination(),
  validateRequest,
], getAllInternships);
router.get('/recommended', authenticate, authorize('STUDENT'), getRecommendedInternships);
router.get('/:id', [idParam(), validateRequest], getInternshipById);
router.get('/:internshipId/match-score', authenticate, authorize('STUDENT'), [
  idParam('internshipId'),
  validateRequest,
], getMatchScore);

export default router;
