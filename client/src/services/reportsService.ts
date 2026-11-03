import axios from 'axios';

const reportsApi = axios.create({ baseURL: '/api', withCredentials: true });

export interface StudentReadinessData {
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

export interface ApplicationReportData {
  totalApplications: number;
  byStatus: Record<string, number>;
  acceptanceRate: number;
  averageTimeToDecision: number | null;
  topInternships: Array<{ title: string; applications: number }>;
}

export interface DashboardReportData {
  studentReadiness: { total: number; averageScore: number };
  internshipMatch: { total: number; averageMatch: number | null };
  applicationStats: ApplicationReportData;
  skillsDemand: { total: number; highDemandGaps: SkillDemandData[] };
}

export interface MatchReportData {
  applicationId: string;
  studentName: string;
  internshipTitle: string;
  companyName: string;
  matchScore: number | null; // Application-time snapshot.
  matchPercentage: number | null;
  status: string;
}

export interface SkillDemandData {
  skillName: string;
  category: string;
  demandCount: number;
  availableStudents: number;
  gap: number;
  demandPressure: 'high' | 'balanced' | 'low';
}

export class ReportsService {
  /**
   * Get Student Readiness Report
   */
  static async getStudentReadinessReport(studentId?: string): Promise<StudentReadinessData[]> {
    try {
      const url = studentId
        ? `/reports/student-readiness/${studentId}`
        : '/reports/student-readiness';

      const response = await reportsApi.get<{ data: StudentReadinessData[] }>(url);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching student readiness report:', error);
      throw error;
    }
  }

  /**
   * Get Internship Match Report
   */
  static async getInternshipMatchReport(): Promise<MatchReportData[]> {
    try {
      const response = await reportsApi.get<{ data: MatchReportData[] }>('/reports/internship-match');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching internship match report:', error);
      throw error;
    }
  }

  /**
   * Get Application Statistics Report
   */
  static async getApplicationStatisticsReport(): Promise<ApplicationReportData> {
    try {
      const response = await reportsApi.get<{ data: ApplicationReportData }>('/reports/application-statistics');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching application statistics report:', error);
      throw error;
    }
  }

  /**
   * Get Skills Demand Report
   */
  static async getSkillsDemandReport(): Promise<SkillDemandData[]> {
    try {
      const response = await reportsApi.get<{ data: SkillDemandData[] }>('/reports/skills-demand');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching skills demand report:', error);
      throw error;
    }
  }

  /**
   * Get Dashboard Data (all reports combined)
   */
  static async getDashboardData(): Promise<DashboardReportData> {
    try {
      const response = await reportsApi.get<{ data: DashboardReportData }>('/reports/dashboard');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  /**
   * Export report to PDF
   */
  static async exportToPDF(reportType: 'readiness' | 'match' | 'applications' | 'skills') {
    try {
      let endpoint = '';
      let fileName = '';

      switch (reportType) {
        case 'readiness':
          endpoint = 'student-readiness';
          fileName = 'student-readiness-report';
          break;
        case 'match':
          endpoint = 'internship-match';
          fileName = 'internship-match-report';
          break;
        case 'applications':
          endpoint = 'application-statistics';
          fileName = 'application-statistics-report';
          break;
        case 'skills':
          endpoint = 'skills-demand';
          fileName = 'skills-demand-report';
          break;
      }

      const response = await reportsApi.get(`/reports/${endpoint}`, {
        params: { export: 'pdf' },
        responseType: 'blob',
      });

      // Create a blob URL and download the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error(`Error exporting ${reportType} report to PDF:`, error);
      throw error;
    }
  }
}
