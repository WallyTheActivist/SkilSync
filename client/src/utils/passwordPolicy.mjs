export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_POLICY_GUIDANCE = 'Use 12 to 72 characters and no more than 72 UTF-8 bytes.';

export const getPasswordRequirements = (password) => [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
  { id: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
  { id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
  { id: 'number', label: 'One number', met: /[0-9]/.test(password) },
  { id: 'special', label: 'One special character', met: /[^A-Za-z0-9\s]/u.test(password) },
];

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
  if (getPasswordRequirements(password).some(({ met }) => !met)) {
    return 'Your password must contain at least 12 characters, an uppercase letter, a lowercase letter, a number, and a special character.';
  }
  return null;
};

export const passwordsMatch = (password, confirmation) => password === confirmation;

export const getPasswordStrengthScore = (password) => {
  if (!password) return 0;
  if (getPasswordValidationError(password) !== null) return 0;

  return 4;
};