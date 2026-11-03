import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';
import { idParam, optionalQueryEnum, validateRequest } from '../middleware/validation';

const router = Router();

/**
 * Reports Routes
 * All routes require authentication
 */

// Dashboard data (combines all reports)
router.use(authenticate, authorize('ADMIN'));
router.get('/dashboard', ReportController.getDashboardData);

// Student Readiness Report
router.get(
  '/student-readiness',
  [optionalQueryEnum('export', ['pdf']), validateRequest],
  ReportController.getStudentReadinessReport
);
router.get(
  '/student-readiness/:studentId',
  [idParam('studentId'), optionalQueryEnum('export', ['pdf']), validateRequest],
  ReportController.getStudentReadinessReport
);

// Internship Match Report
router.get(
  '/internship-match',
  [optionalQueryEnum('export', ['pdf']), validateRequest],
  ReportController.getInternshipMatchReport
);

// Application Statistics Report
router.get(
  '/application-statistics',
  [optionalQueryEnum('export', ['pdf']), validateRequest],
  ReportController.getApplicationStatisticsReport
);

// Skills Demand Report
router.get(
  '/skills-demand',
  [optionalQueryEnum('export', ['pdf']), validateRequest],
  ReportController.getSkillsDemandReport
);

export default router;
