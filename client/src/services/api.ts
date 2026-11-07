import axios from 'axios';
import { isAuthenticationRequest } from '../utils/authRequest.js';
import type { StudentProfileUpdate } from '../utils/studentProfileUpdate.mjs';
import type { EmployerProfileUpdate } from '../utils/employerProfileUpdate.mjs';
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  StudentProfile,
  Skill,
  StudentSkill,
  Internship,
  EmployerProfile,
  Application,
  Recommendation,
  MatchScoreResult,
  SkillGapAnalysis,
  ProficiencyLevel,
  CreateInternshipData,
  ApplicationWithStudent,
  EmployerDashboardStats,
  AdminStats,
  AdminAnalytics,
  AdminUser,
  AdminApplication,
  AdminSkill,
  ReadinessBreakdown,
  ApplicationStatus,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isAuthenticationRequest(err.config?.url)) {
      localStorage.removeItem('ss_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    university?: string;
    role?: 'STUDENT' | 'EMPLOYER';
    companyName?: string;
  }) => api.post<ApiResponse<{ user: User }>>('/auth/register', data),

  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: User }>>('/auth/login', { email, password }),

  logout: () => api.post<ApiResponse<null>>('/auth/logout'),

  getMe: () => api.get<ApiResponse<User>>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<ApiResponse<null>>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse<null>>('/auth/reset-password', { token, password }),
};

// ─── Student ─────────────────────────────────────────────────────────────────
export const studentApi = {
  getProfile: () => api.get<ApiResponse<StudentProfile>>('/student/profile'),

  updateProfile: (data: StudentProfileUpdate) =>
    api.put<ApiResponse<StudentProfile>>('/student/profile', data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<ApiResponse<{ avatarUrl: string }>>('/student/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getReadinessScore: () =>
    api.get<ApiResponse<{ readinessScore: number; breakdown: ReadinessBreakdown }>>('/student/readiness-score'),

  getSkillGap: () => api.get<ApiResponse<SkillGapAnalysis>>('/student/skill-gap'),

  getRecommendations: () => api.get<ApiResponse<Recommendation[]>>('/student/recommendations'),

  markRecommendationComplete: (id: string) =>
    api.patch<ApiResponse<Recommendation>>(`/student/recommendations/${id}/complete`),
};

// ─── Skills ───────────────────────────────────────────────────────────────────
export const skillsApi = {
  getAll: () => api.get<ApiResponse<Skill[]>>('/skills'),

  getMySkills: () => api.get<ApiResponse<StudentSkill[]>>('/skills/my-skills'),

  addSkill: (skillId: string, proficiency: ProficiencyLevel, yearsExperience?: number) =>
    api.post<ApiResponse<StudentSkill>>('/skills/my-skills', {
      skillId,
      proficiency,
      yearsExperience,
    }),

  updateSkill: (id: string, data: { proficiency?: ProficiencyLevel; yearsExperience?: number }) =>
    api.put<ApiResponse<StudentSkill>>(`/skills/my-skills/${id}`, data),

  removeSkill: (id: string) => api.delete(`/skills/my-skills/${id}`),
};

// ─── Internships ─────────────────────────────────────────────────────────────
export const internshipsApi = {
  getAll: (params?: {
    search?: string;
    industry?: string;
    isRemote?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Internship>>('/internships', { params }),

  getById: (id: string) => api.get<ApiResponse<Internship>>(`/internships/${id}`),

  getRecommended: () => api.get<ApiResponse<Internship[]>>('/internships/recommended'),

  getMatchScore: (internshipId: string) =>
    api.get<ApiResponse<MatchScoreResult>>(`/internships/${internshipId}/match-score`),
};

// ─── Applications ────────────────────────────────────────────────────────────
export const applicationsApi = {
  apply: (internshipId: string, coverLetter?: string) =>
    api.post<ApiResponse<Application>>('/applications', { internshipId, coverLetter }),

  getMyApplications: () =>
    api.get<ApiResponse<Application[]>>('/applications/my-applications'),

  getMyApplicationsDashboard: () =>
    api.get<ApiResponse<{ applications: Application[]; total: number }>>('/applications/my-applications/dashboard'),

  withdraw: (id: string) =>
    api.patch<ApiResponse<Application>>(`/applications/${id}/withdraw`),
};

// ─── Employer ─────────────────────────────────────────────────────────────────
export const employerApi = {
  getDashboardStats: () => api.get<ApiResponse<EmployerDashboardStats>>('/employer/dashboard/stats'),

  getProfile: () => api.get<ApiResponse<EmployerProfile>>('/employer/profile'),
  updateProfile: (data: EmployerProfileUpdate) =>
    api.put<ApiResponse<EmployerProfile>>('/employer/profile', data),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<ApiResponse<{ logoUrl: string }>>('/employer/profile/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getMyInternships: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Internship>>('/employer/internships', { params }),
  getMyInternship: (id: string) =>
    api.get<ApiResponse<Internship>>(`/employer/internships/${id}`),
  createInternship: (data: CreateInternshipData) =>
    api.post<ApiResponse<Internship>>('/employer/internships', data),
  updateInternship: (id: string, data: Partial<CreateInternshipData>) =>
    api.put<ApiResponse<Internship>>(`/employer/internships/${id}`, data),
  deleteInternship: (id: string) =>
    api.delete(`/employer/internships/${id}`),
  getApplicants: (internshipId: string, status?: string) =>
    api.get<ApiResponse<ApplicationWithStudent[]>>(`/employer/internships/${internshipId}/applicants`, {
      params: { status },
    }),
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus, notes?: string) =>
    api.patch<ApiResponse<Application>>(`/employer/applications/${applicationId}/status`, { status, notes }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get<ApiResponse<AdminStats>>('/admin/stats'),
  getAnalytics: () => api.get<ApiResponse<AdminAnalytics>>('/admin/analytics'),

  getStudents: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AdminUser>>('/admin/students', { params }),
  getEmployers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AdminUser>>('/admin/employers', { params }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  getInternships: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Internship>>('/admin/internships', { params }),
  updateInternship: (id: string, data: { status?: string; title?: string }) =>
    api.patch<ApiResponse<Internship>>(`/admin/internships/${id}`, data),
  deleteInternship: (id: string) => api.delete(`/admin/internships/${id}`),

  getApplications: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AdminApplication>>('/admin/applications', { params }),

  getSkills: (params?: { search?: string; category?: string }) =>
    api.get<ApiResponse<AdminSkill[]>>('/admin/skills', { params }),
  createSkill: (data: { name: string; category: string; description?: string }) =>
    api.post<ApiResponse<Skill>>('/admin/skills', data),
  updateSkill: (id: string, data: { name?: string; category?: string; description?: string }) =>
    api.put<ApiResponse<Skill>>(`/admin/skills/${id}`, data),
  deleteSkill: (id: string) => api.delete(`/admin/skills/${id}`),
};

export default api;
