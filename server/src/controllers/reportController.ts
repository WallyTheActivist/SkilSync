import { Request, Response } from 'express';
import { ReportService } from '../services/reportService';

export class ReportController {
  /**
   * Get Student Readiness Report
   * GET /api/reports/student-readiness/:studentId?
   */
  static async getStudentReadinessReport(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const data = await ReportService.getStudentReadinessReport(studentId);

      if (req.query.export === 'pdf') {
        const fileName = studentId
          ? `student-readiness-${studentId}`
          : 'student-readiness-all';
        return ReportService.exportToPDF(
          'readiness',
          data,
          res,
          fileName
        );
      }

      res.json({
        success: true,
        data,
        timestamp: new Date(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to generate report.',
      });
    }
  }

  /**
   * Get Internship Match Report
   * GET /api/reports/internship-match
   */
  static async getInternshipMatchReport(req: Request, res: Response) {
    try {
      const data = await ReportService.getInternshipMatchReport();

      if (req.query.export === 'pdf') {
        return ReportService.exportToPDF(
          'match',
          data,
          res,
          'internship-match-report'
        );
      }

      res.json({
        success: true,
        data,
        timestamp: new Date(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to generate report.',
      });
    }
  }

  /**
   * Get Application Statistics Report
   * GET /api/reports/application-statistics
   */
  static async getApplicationStatisticsReport(req: Request, res: Response) {
    try {
      const data = await ReportService.getApplicationStatisticsReport();

      if (req.query.export === 'pdf') {
        return ReportService.exportToPDF(
          'applications',
          data,
          res,
          'application-statistics'
        );
      }

      res.json({
        success: true,
        data,
        timestamp: new Date(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to generate report.',
      });
    }
  }

  /**
   * Get Skills Demand Report
   * GET /api/reports/skills-demand
   */
  static async getSkillsDemandReport(req: Request, res: Response) {
    try {
      const data = await ReportService.getSkillsDemandReport();

      if (req.query.export === 'pdf') {
        return ReportService.exportToPDF(
          'skills',
          data,
          res,
          'skills-demand-report'
        );
      }

      res.json({
        success: true,
        data,
        timestamp: new Date(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to generate report.',
      });
    }
  }

  /**
   * Get all reports dashboard data
   * GET /api/reports/dashboard
   */
  static async getDashboardData(req: Request, res: Response) {
    try {
      const [
        studentReadiness,
        internshipMatch,
        applicationStats,
        skillsDemand,
      ] = await Promise.all([
        ReportService.getStudentReadinessReport(),
        ReportService.getInternshipMatchReport(),
        ReportService.getApplicationStatisticsReport(),
        ReportService.getSkillsDemandReport(),
      ]);
      const scoredMatchScores = internshipMatch
        .map((match) => match.matchScore)
        .filter((score): score is number => score !== null);

      res.json({
        success: true,
        data: {
          studentReadiness: {
            total: studentReadiness.length,
            averageScore:
              studentReadiness.length > 0
                ? studentReadiness.reduce(
                    (sum, s) => sum + s.readinessScore,
                    0
                  ) / studentReadiness.length
                : 0,
          },
          internshipMatch: {
            total: internshipMatch.length,
            averageMatch: scoredMatchScores.length > 0
              ? scoredMatchScores.reduce((sum, score) => sum + score, 0) / scoredMatchScores.length
              : null,
          },
          applicationStats,
          skillsDemand: {
            total: skillsDemand.length,
            highDemandGaps: skillsDemand
              .sort((a, b) => b.gap - a.gap)
              .slice(0, 5),
          },
        },
        timestamp: new Date(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to generate reports dashboard.',
      });
    }
  }
}
