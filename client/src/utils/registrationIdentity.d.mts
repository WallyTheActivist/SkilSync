export interface RegistrationIdentityInput {
  firstName: string;
  lastName: string;
  university?: string;
  requireUniversity?: boolean;
}

export interface RegistrationIdentity {
  firstName: string;
  lastName: string;
  university?: string;
}

export declare const normalizePersonName: (value: string, label: string) => string;
export declare const normalizeRegistrationEmail: (value: string, role?: 'STUDENT' | 'EMPLOYER') => string;
export declare const normalizeOrganizationName: (value: string) => string;
export declare const normalizeRegistrationIdentityFields: (
  fields: RegistrationIdentityInput,
) => RegistrationIdentity;
