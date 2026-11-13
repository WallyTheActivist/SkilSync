import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, User, GraduationCap, Building2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import {
  normalizeOrganizationName,
  normalizePersonName,
  normalizeRegistrationEmail,
  normalizeRegistrationIdentityFields,
} from '../../utils/registrationIdentity.mjs';
import {
  getPasswordStrengthScore,
  getPasswordRequirements,
  getPasswordValidationError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_GUIDANCE,
  passwordsMatch,
} from '../../utils/passwordPolicy.mjs';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  university: string;
  companyName: string;
  password: string;
  confirmPassword: string;
  role: 'STUDENT' | 'EMPLOYER';
}

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    university: '',
    companyName: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const getFieldValidationError = (
    field: 'firstName' | 'lastName' | 'email',
    value: string,
    role: FormState['role'] = form.role,
  ): string => {
    try {
      if (field === 'email') {
        normalizeRegistrationEmail(value, role);
      } else {
        normalizePersonName(value, field === 'firstName' ? 'First name' : 'Last name');
      }
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Please check this field.';
    }
  };

  const validateOnBlur = (field: 'firstName' | 'lastName' | 'email') => () => {
    setFieldErrors((current) => {
      const next = { ...current };
      const error = getFieldValidationError(field, form[field]);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const validateOrganizationOnBlur = () => {
    if (form.role !== 'EMPLOYER' || !form.companyName) return;
    setFieldErrors((current) => {
      try {
        normalizeOrganizationName(form.companyName);
        const next = { ...current };
        delete next.companyName;
        return next;
      } catch (error) {
        return {
          ...current,
          companyName: error instanceof Error ? error.message : 'Please enter an organisation name.',
        };
      }
    });
  };

  const changeRole = (role: FormState['role']) => {
    setForm((current) => ({ ...current, role }));
    setFieldErrors((current) => {
      const next = { ...current };
      const emailError = form.email ? getFieldValidationError('email', form.email, role) : '';
      if (emailError) next.email = emailError;
      else delete next.email;
      return next;
    });
  };

  const passwordStrength = getPasswordStrengthScore(form.password);
  const passwordRequirements = getPasswordRequirements(form.password);

  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    let normalizedEmail = '';
    for (const field of ['firstName', 'lastName', 'email'] as const) {
      const error = getFieldValidationError(field, form[field]);
      if (error) nextErrors[field] = error;
    }
    try {
      normalizedEmail = normalizeRegistrationEmail(form.email, form.role);
    } catch {
      // The field-specific error is already recorded above.
    }
    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else {
      const passwordError = getPasswordValidationError(form.password);
      if (passwordError) nextErrors.password = passwordError;
    }
    if (form.role === 'STUDENT' && !form.university.trim()) nextErrors.university = 'University is required.';
    let normalizedCompanyName = '';
    if (form.role === 'EMPLOYER') {
      try {
        normalizedCompanyName = normalizeOrganizationName(form.companyName);
      } catch (error) {
        nextErrors.companyName = error instanceof Error ? error.message : 'Please enter an organisation name.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      toast.error('Please correct the required registration fields.');
      return;
    }

    let identity: ReturnType<typeof normalizeRegistrationIdentityFields>;
    try {
      identity = normalizeRegistrationIdentityFields({
        ...form,
        university: form.role === 'STUDENT' ? form.university : undefined,
        requireUniversity: form.role === 'STUDENT',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please check your name and registration details.';
      setFieldErrors((current) => ({ ...current, university: form.role === 'STUDENT' ? message : current.university || '' }));
      toast.error(message);
      return;
    }

    if (!passwordsMatch(form.password, form.confirmPassword)) {
      setFieldErrors((current) => ({ ...current, confirmPassword: 'Passwords do not match.' }));
      toast.error('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const registeredUser = await register({
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: normalizedEmail,
        university: form.role === 'STUDENT' ? identity.university : undefined,
        companyName: form.role === 'EMPLOYER' ? normalizedCompanyName : undefined,
        password: form.password,
        role: form.role,
      });
      if (form.role === 'EMPLOYER') {
        toast.success('Account created. Check your email to verify your organisation.');
        navigate('/verify-email/pending', { state: { email: registeredUser.email } });
      } else {
        toast.success('Account created! Welcome to SkillSync.');
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    'Personalised internship recommendations',
    'Skill gap analysis & improvement tips',
    'Real-time match scoring',
    'Track all your applications in one place',
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-primary-950 via-primary-800 to-primary-600 relative overflow-hidden flex-col justify-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-white/5 rounded-full" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-2xl">SkillSync</span>
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Start Your Career<br />Journey Today
          </h1>
          <p className="text-primary-200 mb-10">
            Join thousands of students already using SkillSync to land their dream internships.
          </p>
          <ul className="space-y-4">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <CheckCircle size={18} className="text-primary-300 shrink-0" />
                <span className="text-primary-100 text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-primary-700 font-bold text-xl">SkillSync</span>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h2>
          <p className="text-gray-500 mb-6">It only takes a minute to get started.</p>

          {/* Role toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
            {(['STUDENT', 'EMPLOYER'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => changeRole(role)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.role === role ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {role === 'STUDENT' ? '🎓 Student' : '🏢 Employer'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={form.firstName} onChange={set('firstName')} onBlur={validateOnBlur('firstName')}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.firstName ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="Alex" required
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                  />
                </div>
                {fieldErrors.firstName && <p id="firstName-error" className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={form.lastName} onChange={set('lastName')} onBlur={validateOnBlur('lastName')}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.lastName ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="Johnson" required
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                  />
                </div>
                {fieldErrors.lastName && <p id="lastName-error" className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email" value={form.email} onChange={set('email')} onBlur={validateOnBlur('email')}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.email ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="you@university.ac.za" required autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
              </div>
              {fieldErrors.email && <p id="email-error" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            {form.role === 'STUDENT' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">University <span className="text-red-500">*</span></label>
                <div className="relative">
                  <GraduationCap size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={form.university} onChange={set('university')}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.university ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="Richfield Graduate Institute"
                    required
                    aria-invalid={Boolean(fieldErrors.university)}
                    aria-describedby={fieldErrors.university ? 'university-error' : undefined}
                  />
                </div>
                {fieldErrors.university && <p id="university-error" className="mt-1 text-xs text-red-600">{fieldErrors.university}</p>}
              </div>
            ) : (
              <div>
                <label htmlFor="companyName" className="block text-sm font-semibold text-gray-800 mb-1.5">Organisation / Business Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="companyName" type="text" value={form.companyName} onChange={set('companyName')} onBlur={validateOrganizationOnBlur}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.companyName ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="Acme Corp" maxLength={160}
                    required
                    aria-invalid={Boolean(fieldErrors.companyName)}
                    aria-describedby={fieldErrors.companyName ? 'companyName-error' : undefined}
                  />
                </div>
                {fieldErrors.companyName && <p id="companyName-error" className="mt-1 text-xs text-red-600">{fieldErrors.companyName}</p>}
                <p className="mt-1 text-xs text-gray-500">Enter the organisation name associated with your employer account.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  className={`w-full pl-9 pr-12 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.password ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="12-72 characters" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={`password-requirements${fieldErrors.password ? ' password-error' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {fieldErrors.password && <p id="password-error" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
              <div id="password-requirements" className="mt-2">
                <p className="text-xs font-medium text-gray-700 mb-1">Password requirements:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-xs">
                  {passwordRequirements.map((requirement) => (
                    <li
                      key={requirement.id}
                      className={requirement.met ? 'text-emerald-700' : 'text-gray-500'}
                    >
                      <span aria-hidden="true" className="inline-block w-4 font-semibold">
                        {requirement.met ? '✓' : '○'}
                      </span>
                      {requirement.label}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_GUIDANCE}</p>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Strength: <span className="font-medium">{form.password ? strengthLabels[Math.max(0, passwordStrength - 1)] : ''}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="Repeat password" required
                />
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg" className="mt-2">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
