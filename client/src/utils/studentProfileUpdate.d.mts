import type { StudentProfile } from '../types';

export type StudentProfileForm = Omit<Partial<StudentProfile>, 'yearOfStudy' | 'gpa'> & {
  yearOfStudy?: number | string | null;
  gpa?: number | string | null;
};

export type StudentProfileUpdate = Omit<Partial<StudentProfile>, 'yearOfStudy' | 'gpa'> & {
  yearOfStudy?: number | null;
  gpa?: number | null;
};

export declare const normalizeStudentProfileUpdate: (form: StudentProfileForm) => StudentProfileUpdate;
