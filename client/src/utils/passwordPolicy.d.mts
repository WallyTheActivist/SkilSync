export declare const PASSWORD_MIN_LENGTH: number;
export declare const PASSWORD_MAX_LENGTH: number;
export declare const PASSWORD_POLICY_GUIDANCE: string;
export declare const getPasswordValidationError: (password: string) => string | null;
export declare const passwordsMatch: (password: string, confirmation: string) => boolean;
export declare const getPasswordStrengthScore: (password: string) => number;