import type { AdminBackup } from '../types';

export declare const getBackupValidationLabel: (
  backup: Pick<AdminBackup, 'creationResult' | 'validationStatus' | 'sha256'> | null | undefined,
) => 'Passed' | 'Failed' | 'Not verified';
