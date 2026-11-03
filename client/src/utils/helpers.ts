import type { ProficiencyLevel, ApplicationStatus, SkillCategory } from '../types';

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  BEGINNER: 'Beginner',
  ELEMENTARY: 'Basic',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export const PROFICIENCY_SCORES: Record<ProficiencyLevel, number> = {
  BEGINNER: 1,
  ELEMENTARY: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
  EXPERT: 5,
};

export const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  BEGINNER: 'bg-gray-100 text-gray-600',
  ELEMENTARY: 'bg-blue-100 text-blue-700',
  INTERMEDIATE: 'bg-indigo-100 text-indigo-700',
  ADVANCED: 'bg-purple-100 text-purple-700',
  EXPERT: 'bg-emerald-100 text-emerald-700',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-indigo-100 text-indigo-700',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-700',
  OFFERED: 'bg-emerald-100 text-emerald-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  PROGRAMMING: 'Programming',
  FRAMEWORK: 'Frameworks',
  DATABASE: 'Databases',
  CLOUD: 'Cloud',
  DEVOPS: 'DevOps',
  DESIGN: 'Design',
  SOFT_SKILL: 'Soft Skills',
  LANGUAGE: 'Languages',
  TOOL: 'Tools',
  OTHER: 'Other',
};

export const SKILL_CATEGORY_COLORS: Record<SkillCategory, string> = {
  PROGRAMMING: 'bg-blue-100 text-blue-700',
  FRAMEWORK: 'bg-indigo-100 text-indigo-700',
  DATABASE: 'bg-amber-100 text-amber-700',
  CLOUD: 'bg-sky-100 text-sky-700',
  DEVOPS: 'bg-orange-100 text-orange-700',
  DESIGN: 'bg-pink-100 text-pink-700',
  SOFT_SKILL: 'bg-teal-100 text-teal-700',
  LANGUAGE: 'bg-violet-100 text-violet-700',
  TOOL: 'bg-gray-100 text-gray-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

export const getMatchScoreColor = (score: number): string => {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-green-600';
  if (score >= 55) return 'text-indigo-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-500';
};

export const getMatchScoreBg = (score: number): string => {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-green-500';
  if (score >= 55) return 'bg-indigo-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const getReadinessLabel = (score: number): string => {
  if (score >= 85) return 'Highly Ready';
  if (score >= 70) return 'Ready';
  if (score >= 50) return 'Developing';
  return 'Not Ready';
};

export const getReadinessColor = (score: number): string => {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-indigo-600';
  return 'text-red-500';
};

export const formatCurrency = (amount: number, currency = 'ZAR'): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getAvatarUrl = (avatarUrl?: string | null): string => {
  if (!avatarUrl) return '';
  const externalUrl = getSafeExternalUrl(avatarUrl);
  if (externalUrl) return externalUrl;
  return `/${avatarUrl}`;
};

export const getSafeExternalUrl = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export const getInitials = (firstName?: string, lastName?: string): string => {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return `${f}${l}`.toUpperCase();
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};
