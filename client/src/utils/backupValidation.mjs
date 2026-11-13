export const getBackupValidationLabel = (backup) => {
  if (!backup) return 'Not verified';
  if (backup.creationResult === 'failed' || backup.validationStatus === 'failed') return 'Failed';
  if (backup.validationStatus === 'passed' && /^[a-f0-9]{64}$/i.test(backup.sha256 ?? '')) {
    return 'Passed';
  }
  return 'Not verified';
};
