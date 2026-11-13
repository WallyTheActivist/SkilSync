import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { authApi } from '../../services/api';

type VerificationState = 'verifying' | 'verified' | 'error';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>('verifying');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = searchParams.get('token');
    navigate('/verify-email', { replace: true });

    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token. Request a new verification email.');
      return;
    }

    authApi.verifyEmail(token)
      .then(({ data }) => {
        setState('verified');
        setMessage(data.message || 'Your organisation email has been verified.');
      })
      .catch((error: unknown) => {
        const apiMessage = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        setState('error');
        setMessage(apiMessage || 'We could not verify this link. Request a new verification email.');
      });
  }, [navigate, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <MailCheck className="mx-auto mb-4 text-primary-600" size={40} />
        <h1 className="mb-3 text-2xl font-bold text-gray-900">Organisation email verification</h1>
        <p aria-live="polite" className={state === 'error' ? 'mb-6 text-sm text-red-600' : 'mb-6 text-sm text-gray-600'}>
          {message}
        </p>
        {state === 'verifying' && (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        )}
        {state === 'verified' && (
          <Link className="font-medium text-primary-600 hover:text-primary-700" to="/login">
            Continue to sign in
          </Link>
        )}
        {state === 'error' && (
          <div className="flex flex-col gap-3">
            <Link className="font-medium text-primary-600 hover:text-primary-700" to="/verify-email/pending">
              Request another verification email
            </Link>
            <Link className="text-sm text-gray-500 hover:text-gray-700" to="/login">
              Back to sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  );
};

export default VerifyEmail;
