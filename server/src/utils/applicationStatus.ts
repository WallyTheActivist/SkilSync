export const APPLICATION_STATUS_VALUES = [
  'PENDING',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];

export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = ['ACCEPTED', 'REJECTED', 'WITHDRAWN'];

export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const canTransitionApplicationStatus = (currentStatus: string, nextStatus: string): boolean => {
  if (!APPLICATION_STATUS_VALUES.includes(currentStatus as ApplicationStatus)) return false;
  if (!APPLICATION_STATUS_VALUES.includes(nextStatus as ApplicationStatus)) return false;

  if (currentStatus === nextStatus) {
    return !TERMINAL_APPLICATION_STATUSES.includes(currentStatus as ApplicationStatus);
  }

  if (TERMINAL_APPLICATION_STATUSES.includes(currentStatus as ApplicationStatus)) {
    return false;
  }

  return APPLICATION_STATUS_TRANSITIONS[currentStatus as ApplicationStatus].includes(nextStatus as ApplicationStatus);
};
