import { Response } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../config/database';

interface StudentReadinessData {
  id: string;
  firstName: string;
  lastName: string;
  readinessScore: number;
  skillCount: number;
  applicationCount: number;
  skills: Array<{
    name: string;
    proficiency: string;
  }>;
}

interface MatchReportData {
  applicationId: string;
  studentName: string;
  internshipTitle: string;
  companyName: string;
  matchScore: number | null;
  matchPercentage: number | null;
  status: string;
}

interface ApplicationStats {
  totalApplications: number;
  byStatus: Record<string, number>;
  acceptanceRate: number;
  averageTimeToDecision: number | null;
  topInternships: Array<{
    title: string;
    applications: number;
  }>;
}

interface SkillDemandData {
  skillName: string;
  category: string;
  demandCount: number;
  availableStudents: number;
  gap: number;
  demandPressure: 'high' | 'balanced' | 'low';
}

export class ReportService {
  /**
   * Generate Student Readiness Report
   */
  static async getStudentReadinessReport(
    studentId?: string
  ): Promise<StudentReadinessData[]> {
    const whereClause = studentId ? { id: studentId } : {};

    const students = await prisma.studentProfile.findMany({
      where: whereClause,
      include: {
        studentSkills: {
          include: {
            skill: true,
          },
        },
        applications: true,
      },
    });

    return students.map((student) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      readinessScore: student.readinessScore,
      skillCount: student.studentSkills.length,
      applicationCount: student.applications.length,
      skills: student.studentSkills.map((ss) => ({
        name: ss.skill.name,
        proficiency: ss.proficiency,
      })),
    }));
  }

  /**
   * Generate Internship Match Report
   */
  static async getInternshipMatchReport(): Promise<MatchReportData[]> {
    const applications = await prisma.application.findMany({
      include: {
        studentProfile: true,
        internship: {
          include: {
            employer: true,
          },
        },
      },
      orderBy: {
        matchScore: 'desc',
      },
    });

    return applications.map((app) => ({
      applicationId: app.id,
      studentName: `${app.studentProfile.firstName} ${app.studentProfile.lastName}`,
      internshipTitle: app.internship.title,
      companyName: app.internship.employer.companyName,
      matchScore: app.matchScore,
      matchPercentage: app.matchScore === null ? null : Math.round(app.matchScore * 100) / 100,
      status: app.status,
    }));
  }

  /**
   * Generate Application Statistics Report
   */
  static async getApplicationStatisticsReport(): Promise<ApplicationStats> {
    const applications = await prisma.application.findMany({
      include: {
        internship: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let acceptedCount = 0;

    applications.forEach((app) => {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
      if (app.status === 'ACCEPTED') acceptedCount++;
    });

    // Get top internships by application count
    const internshipCounts: Record<string, { title: string; count: number }> =
      {};
    applications.forEach((app) => {
      if (!internshipCounts[app.internship.id]) {
        internshipCounts[app.internship.id] = {
          title: app.internship.title,
          count: 0,
        };
      }
      internshipCounts[app.internship.id].count++;
    });

    const topInternships = Object.values(internshipCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        title: item.title,
        applications: item.count,
      }));

    return {
      totalApplications: applications.length,
      byStatus,
      acceptanceRate:
        applications.length > 0
          ? Math.round((acceptedCount / applications.length) * 100)
          : 0,
      averageTimeToDecision: null,
      topInternships,
    };
  }

  /**
   * Generate Skills Demand Report
   */
  static async getSkillsDemandReport(): Promise<SkillDemandData[]> {
    const skills = await prisma.skill.findMany({
      include: {
        internshipSkills: {
          where: { internship: { status: 'ACTIVE' } },
        },
        studentSkills: true,
      },
    });

    return skills.map((skill) => ({
      skillName: skill.name,
      category: skill.category,
      demandCount: skill.internshipSkills.length,
      availableStudents: skill.studentSkills.length,
      gap: skill.internshipSkills.length - skill.studentSkills.length,
      demandPressure:
        skill.internshipSkills.length > skill.studentSkills.length * 1.5
          ? 'high'
          : skill.internshipSkills.length < skill.studentSkills.length * 0.5
            ? 'low'
            : 'balanced',
    }));
  }

  /**
   * Export report to PDF
   */
  static async exportToPDF(
    reportType: 'readiness' | 'match' | 'applications' | 'skills',
    data: any,
    res: Response,
    fileName: string
  ): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Setup response headers
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}.pdf"`
    );
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Add title and metadata
    doc.fontSize(20).font('Helvetica-Bold').text('SkillSync Report', {
      align: 'center',
    });
    doc.fontSize(12).font('Helvetica').text(`Report Type: ${reportType}`, {
      align: 'center',
    });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, {
      align: 'center',
    });
    doc.moveDown();

    // Add report content based on type
    switch (reportType) {
      case 'readiness':
        await this._addReadinessReportContent(doc, data);
        break;
      case 'match':
        await this._addMatchReportContent(doc, data);
        break;
      case 'applications':
        await this._addApplicationsReportContent(doc, data);
        break;
      case 'skills':
        await this._addSkillsReportContent(doc, data);
        break;
    }

    doc.end();
  }

  /**
   * Helper: Add Readiness Report Content to PDF
   */
  private static _addReadinessReportContent(
    doc: PDFKit.PDFDocument,
    data: StudentReadinessData[]
  ): void {
    doc.fontSize(14).font('Helvetica-Bold').text('Student Readiness Report');
    doc.moveDown();

    doc.fontSize(10).font('Helvetica');
    doc.text(
      `Total Student Profiles: ${data.length} | Average Last-Recorded Readiness Score: ${data.length > 0
        ? (data.reduce((sum, s) => sum + s.readinessScore, 0) / data.length).toFixed(2)
        : 'Unavailable'}`
    );
    doc.moveDown();

    data.forEach((student, index) => {
      if (index > 0) doc.addPage();

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${student.firstName} ${student.lastName}`);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Last-Recorded Readiness Score: ${student.readinessScore.toFixed(2)}/100`);
      doc.text(`Skills: ${student.skillCount}`);
      doc.text(`Applications: ${student.applicationCount}`);

      if (student.skills.length > 0) {
        doc.moveDown();
        doc.fontSize(11).font('Helvetica-Bold').text('Skills:');
        student.skills.forEach((skill) => {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(`• ${skill.name} (${skill.proficiency})`);
        });
      }

      doc.moveDown();
    });
  }

  /**
   * Helper: Add Match Report Content to PDF
   */
  private static _addMatchReportContent(
    doc: PDFKit.PDFDocument,
    data: MatchReportData[]
  ): void {
    doc.fontSize(14).font('Helvetica-Bold').text('Internship Match Report');
    doc.moveDown();

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total Applications: ${data.length} | Scored Snapshots: ${data.filter((match) => match.matchPercentage !== null).length}`);
    doc.moveDown();

    data.slice(0, 20).forEach((match, index) => {
      if (index > 0 && index % 5 === 0) doc.addPage();

      doc.fontSize(11).font('Helvetica-Bold').text(match.studentName);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Position: ${match.internshipTitle}`);
      doc.text(`Company: ${match.companyName}`);
      doc.text(`Match Score at application: ${match.matchPercentage === null ? 'Unavailable' : `${match.matchPercentage}%`}`);
      doc.text(`Status: ${match.status}`);
      doc.moveDown(0.5);
    });

    if (data.length > 20) {
      doc.text(`... and ${data.length - 20} more matches`);
    }
  }

  /**
   * Helper: Add Applications Report Content to PDF
   */
  private static _addApplicationsReportContent(
    doc: PDFKit.PDFDocument,
    data: ApplicationStats
  ): void {
    doc.fontSize(14).font('Helvetica-Bold').text('Application Statistics Report');
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('Summary:');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total Applications: ${data.totalApplications}`);
    doc.text(`Acceptance Rate: ${data.acceptanceRate}%`);
    doc.text(`Average Decision Time: ${data.averageTimeToDecision === null ? 'Unavailable (no decision timestamp is recorded)' : `${data.averageTimeToDecision} days`}`);
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('Applications by Status:');
    Object.entries(data.byStatus).forEach(([status, count]) => {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`• ${status}: ${count}`);
    });

    doc.moveDown();
    doc.fontSize(11).font('Helvetica-Bold').text('Top Internships:');
    data.topInternships.forEach((internship) => {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`• ${internship.title}: ${internship.applications} applications`);
    });
  }

  /**
   * Helper: Add Skills Report Content to PDF
   */
  private static _addSkillsReportContent(
    doc: PDFKit.PDFDocument,
    data: SkillDemandData[]
  ): void {
    doc.fontSize(14).font('Helvetica-Bold').text('Skills Demand Report');
    doc.moveDown();

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total Skills Tracked: ${data.length}`);
    doc.moveDown();

    // Sort by active-listing demand gap (highest first).
    const sortedData = [...data].sort((a, b) => b.gap - a.gap);

    doc.fontSize(11).font('Helvetica-Bold').text('Skills with Highest Demand Gap:');
    doc.moveDown(0.5);

    sortedData.slice(0, 15).forEach((skill) => {
      doc.fontSize(10).font('Helvetica-Bold').text(skill.skillName);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Category: ${skill.category} | Demand: ${skill.demandCount}`);
      doc.text(
        `Available Students: ${skill.availableStudents} | Gap: ${skill.gap} | Demand Pressure: ${skill.demandPressure}`
      );
      doc.moveDown(0.5);
    });
  }
}
