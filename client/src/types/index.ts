// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role = 'STUDENT' | 'EMPLOYER' | 'ADMIN';

export type ProficiencyLevel = 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type ApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type InternshipStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'FILLED';

export type BackupValidationStatus = 'passed' | 'failed' | 'unknown';
export type BackupCreationResult = 'running' | 'succeeded' | 'failed' | 'unknown';
export type CloudSynchronizationStatus =
  | 'not_configured'
  | 'configured_but_unavailable'
  | 'local_sync_folder_detected'
  | 'backup_copied_to_sync_folder'
  | 'not_independently_verified';

export interface AdminBackup {
  id: string;
  filename: string | null;
  sha256?: string | null;
  createdAt: string;
  sizeBytes: number;
  backupType: 'database';
  validationStatus: BackupValidationStatus;
  validationDetails: string;
  localStorageStatus: 'available' | 'missing';
  cloudSynchronizationStatus: CloudSynchronizationStatus;
  creationResult: BackupCreationResult;
}

export interface AdminBackupStatus {
  localStorageConfigured: boolean;
  localStorageDirectoryExists: boolean;
  localStorageWritable: boolean;
  cloudSyncConfigured: boolean;
  localSyncFolderDetected: boolean;
  latestBackupCopiedToSyncFolder: boolean;
  cloudSyncVerified: false;
  cloudSyncStatus: CloudSynchronizationStatus;
  latestBackupDate: string | null;
  latestBackupFile: string | null;
}

export type SkillCategory =
  | 'PROGRAMMING'
  | 'FRAMEWORK'
  | 'DATABASE'
  | 'CLOUD'
  | 'DEVOPS'
  | 'DESIGN'
  | 'SOFT_SKILL'
  | 'LANGUAGE'
  | 'TOOL'
  | 'OTHER';

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  profile: StudentProfile | EmployerProfile | null;
}

export interface StudentProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  university?: string;
  faculty?: string;
  degree?: string;
  yearOfStudy?: number;
  gpa?: number;
  bio?: string;
  linkedIn?: string;
  github?: string;
  portfolioUrl?: string;
  avatarUrl?: string;
  city?: string;
  country: string;
  readinessScore: number;
  studentSkills?: StudentSkill[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployerProfile {
  id: string;
  userId: string;
  companyName: string;
  industry?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  city?: string;
  country: string;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
}

export interface StudentSkill {
  id: string;
  studentProfileId: string;
  skillId: string;
  proficiency: ProficiencyLevel;
  yearsExperience?: number;
  certificationUrl?: string;
  skill: Skill;
  createdAt: string;
  updatedAt: string;
}

export interface InternshipSkill {
  id: string;
  internshipId: string;
  skillId: string;
  importance: number;
  minimumLevel: ProficiencyLevel;
  skill: Skill;
}

export interface Internship {
  id: string;
  employerProfileId: string;
  title: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  location?: string;
  isRemote: boolean;
  stipend?: number;
  currency: string;
  durationMonths?: number;
  startDate?: string;
  applicationDeadline?: string;
  status: InternshipStatus;
  industry?: string;
  tags?: string;
  employer: EmployerProfile;
  requiredSkills: InternshipSkill[];
  _count?: { applications: number };
  matchScore?: number | null;
  matchLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  studentProfileId: string;
  internshipId: string;
  status: ApplicationStatus;
  matchScore: number | null; // Match snapshot captured when the application was submitted.
  coverLetter?: string;
  resumeUrl?: string;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
  closedAt: string | null;
  internship: Internship;
}

export interface Recommendation {
  id: string;
  studentProfileId: string;
  type: string;
  title: string;
  description: string;
  resourceUrl?: string;
  priority: number;
  skillId?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchScoreResult {
  overall: number | null; // Null when the internship has no required skills to score.
  label: string;
  breakdown: {
    matched: MatchedSkill[];
    missing: MissingSkill[];
    bonus: BonusSkill[];
  };
  stats: {
    fullMatches: number;
    partialMatches: number;
    missingCount: number;
    earnedPoints: number;
    maxPoints: number;
  };
}

export interface MatchedSkill {
  skillId: string;
  skillName: string;
  studentLevel: ProficiencyLevel;
  requiredLevel: ProficiencyLevel;
  matchType: 'full' | 'partial';
  score: number;
  maxScore: number;
  pct: number;
}

export interface MissingSkill {
  skillId: string;
  skillName: string;
  requiredLevel: ProficiencyLevel;
  importance: number;
}

export interface BonusSkill {
  skillId: string;
  skillName: string;
  studentLevel: ProficiencyLevel;
}

export interface SkillGap {
  skillId: string;
  skillName: string;
  skillCategory: SkillCategory;
  requiredLevel: ProficiencyLevel;
  currentLevel: ProficiencyLevel | null;
  gap: number;
  internships: string[];
  frequency: number;
  gapType: 'missing' | 'weak';
}

export interface RecommendedSkill {
  skillId: string;
  skillName: string;
  skillCategory: SkillCategory;
  frequency: number;
  suggestedLevel: ProficiencyLevel;
}

export interface SkillGapAnalysis {
  overallReadiness: number;
  totalSkillsOwned: number;
  topGaps: SkillGap[];
  missingSkills: SkillGap[];
  weakSkills: SkillGap[];
  recommendedSkills: RecommendedSkill[];
  strongSkills: StrongSkill[];
}

export interface StrongSkill {
  skillId: string;
  skillName: string;
  level: ProficiencyLevel;
  applicableInternships: number;
}

export interface ReadinessComponent {
  score: number;
  weight: number;
  rawValue: number;
  label: string;
}

export interface ReadinessBreakdown {
  overall: number;
  label: string;
  components: {
    skillCount: ReadinessComponent;
    skillProficiency: ReadinessComponent;
    internshipCompatibility: ReadinessComponent;
    applicationHistory: ReadinessComponent;
  };
}

// ─── Employer types ───────────────────────────────────────────────────────────

export interface CreateInternshipSkill {
  skillId: string;
  importance: number;
  minimumLevel: ProficiencyLevel;
}

export interface CreateInternshipData {
  title: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  location?: string;
  isRemote?: boolean;
  stipend?: number;
  currency?: string;
  durationMonths?: number;
  startDate?: string;
  applicationDeadline?: string;
  status?: InternshipStatus;
  industry?: string;
  tags?: string;
  skills?: CreateInternshipSkill[];
}

export interface ApplicationWithStudent {
  id: string;
  studentProfileId: string;
  internshipId: string;
  status: ApplicationStatus;
  matchScore: number | null;
  coverLetter?: string;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
  closedAt: string | null;
  internship?: Pick<Internship, 'title'>;
  studentProfile: StudentProfile & {
    studentSkills?: StudentSkill[];
    _count?: { applications: number; studentSkills: number };
  };
}

export interface EmployerDashboardStats {
  activeInternships: number;
  totalApplications: number;
  pendingApplications: number;
  shortlistedApplications: number;
  recentApplications: ApplicationWithStudent[];
  topCandidates: Array<{
    id: string;
    matchScore: number | null;
    status: ApplicationStatus;
    appliedAt: string;
    studentProfile: { id: string; firstName: string; lastName: string; avatarUrl?: string; university?: string; readinessScore: number };
    internship: { title: string };
  }>;
  applicationsByStatus: Array<{ status: string; _count: number }>;
}

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  studentProfile?: StudentProfile & {
    _count?: { applications: number; studentSkills: number };
  };
  employerProfile?: EmployerProfile & {
    _count?: { internships: number };
  };
}

export interface AdminStats {
  totalStudents: number;
  totalEmployers: number;
  totalInternships: number;
  activeInternships: number;
  totalApplications: number;
  totalSkills: number;
  applicationsByStatus: Array<{ status: string; _count: number }>;
  internshipsByStatus: Array<{ status: string; _count: number }>;
  recentRegistrations: Array<{ id: string; email: string; role: Role; createdAt: string }>;
  topRequestedSkills: Array<{ skillId: string; skillName: string; category: string; count: number }>;
  readinessDistribution: Array<{ tier: string; range: string; color: string; count: number }>;
}

export interface AdminAnalytics {
  topInternships: Array<Internship & { _count: { applications: number } }>;
  topSkills: Array<Skill & { _count: { studentSkills: number } }>;
  matchScores: Array<{ internshipId: string; _avg: { matchScore: number | null }; _count: number }>;
  applicationTrend: Array<{ date: string; count: number }>;
}

export interface AdminApplication {
  id: string;
  studentProfileId: string;
  internshipId: string;
  status: ApplicationStatus;
  matchScore: number | null;
  coverLetter?: string;
  appliedAt: string;
  updatedAt: string;
  studentProfile: { firstName: string; lastName: string; avatarUrl?: string };
  internship: { title: string; employer: { companyName: string } };
}

export interface AdminSkill extends Skill {
  _count: { studentSkills: number; internshipSkills: number };
}
