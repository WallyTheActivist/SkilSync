import type { ApplicationStatus } from '../types';

type UpdateStatusRequest = (
  applicationId: string,
  status: ApplicationStatus,
) => Promise<{ data: { data: { status: ApplicationStatus } } }>;

export function persistApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  updateRequest: UpdateStatusRequest,
  onSaved: (status: ApplicationStatus) => void,
): Promise<ApplicationStatus>;

export function getApplicationStatusUpdateError(error: unknown): string;
