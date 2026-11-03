export interface EmployerProfileUpdateForm {
  companyName: string;
  industry: string;
  website: string;
  description: string;
  city: string;
  country: string;
}

export interface EmployerProfileUpdate extends Omit<EmployerProfileUpdateForm, 'website'> {
  website: string | null;
}

export declare const normalizeEmployerProfileUpdate: (
  form: EmployerProfileUpdateForm,
) => EmployerProfileUpdate;
