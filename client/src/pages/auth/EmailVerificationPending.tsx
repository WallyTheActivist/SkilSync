import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { authApi } from '../../services/api';

const EmailVerificationPending: React.FC = () => {
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setMessage('');
    try {
      const { data } = await authApi.resendVerification(email);
      setMessage(data.message || 'If an unverified employer account exists, the verification request has been accepted.');
    } catch (error: unknown) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setMessage(apiMessage || 'We could not process the request. Please try again later.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <Mail className="mx-auto mb-4 text-primary-600" size={40} />
        <h1 className="mb-3 text-center text-2xl font-bold text-gray-900">Check your organisation email</h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Verify your email address before signing in to employer features.
        </p>
        <form className="space-y-4" onSubmit={resend}>
          <label className="block text-sm font-medium text-gray-700" htmlFor="verification-email">
            Email address
          </label>
          <input
            id="verification-email"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            type="submit"
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Resend verification email'}
          </button>
        </form>
        {message && <p aria-live="polite" className="mt-4 text-sm text-gray-600">{message}</p>}
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link className="font-medium text-primary-600 hover:text-primary-700" to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default EmailVerificationPending;
