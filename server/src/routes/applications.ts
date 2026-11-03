import { Router } from 'express';
import {
  applyForInternship,
  getMyApplicationsDashboard,
  getMyApplications,
  withdrawApplication,
} from '../controllers/applicationController';
import { authenticate, authorize } from '../middleware/auth';
import { idParam, optionalText, requiredText, validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate, authorize('STUDENT'));

router.post('/', [
  requiredText('internshipId', 128),
  optionalText('coverLetter', 5000),
  validateRequest,
], applyForInternship);
router.get('/my-applications/dashboard', getMyApplicationsDashboard);
router.get('/my-applications', getMyApplications);
router.patch('/:id/withdraw', [idParam(), validateRequest], withdrawApplication);

export default router;
