export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_POLICY_GUIDANCE = 'Use 12 to 72 characters and no more than 72 UTF-8 bytes.';

export const getPasswordValidationError = (password) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return `Password must not exceed ${PASSWORD_MAX_LENGTH} UTF-8 bytes.`;
  }
  return null;
};

export const passwordsMatch = (password, confirmation) => password === confirmation;

export const getPasswordStrengthScore = (password) => {
  if (!password) return 0;
  if (getPasswordValidationError(password) !== null) return 0;

  let score = 1;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};