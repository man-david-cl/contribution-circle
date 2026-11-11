'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(true);
  const [emailSendFailed, setEmailSendFailed] = useState(false);

  useEffect(() => {
    if (!showEmailConfirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showEmailConfirmation]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const form = e.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim().toLowerCase();
    const password = String(values.get('password') ?? '');
    const supabase = createClient();

    try {
      if (mode === 'register') {
        const full_name = String(values.get('full_name') ?? '').trim();
        const username = String(values.get('username') ?? '').trim().replace(/^@/, '').toLowerCase();
        const phone = String(values.get('phone') ?? '').trim();

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name, username, phone },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/bank`,
          },
        });

        if (signUpError) {
          const message = signUpError.message || '';
          if (/rate limit|email.*send|sending.*email|too many requests/i.test(message)) {
            setRegisteredEmail(email);
            setConfirmationRequired(true);
            setEmailSendFailed(true);
            setShowEmailConfirmation(true);
            return;
          }
          throw signUpError;
        }

        setRegisteredEmail(email);
        setConfirmationRequired(!data.session);
        setEmailSendFailed(false);
        setShowEmailConfirmation(true);
        form.reset();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} noValidate={false}>
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" maxLength={100} placeholder="Your full legal name" />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" placeholder="Choose a username" />
              <small className="muted">Use 3–30 letters, numbers, or underscores.</small>
            </div>
            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" maxLength={25} placeholder="e.g. +234 800 000 0000" />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" maxLength={254} placeholder="you@example.com" />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-wrap">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" />
            <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <div className="auth-message auth-error" role="alert">{error}</div>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in to your account' : 'Create account'}
        </button>

        <p className="muted auth-switch">
          {mode === 'login' ? 'New to the group? ' : 'Already registered? '}
          <Link href={mode === 'login' ? '/register' : '/login'}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </Link>
        </p>
      </form>

      {showEmailConfirmation && (
        <div className="email-modal-backdrop">
          <section className="email-modal" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
            <div className="email-modal-icon" aria-hidden="true">✉</div>
            <p className="eyebrow">{emailSendFailed ? 'Email delivery delayed' : 'One more step'}</p>
            <h2 id="email-modal-title">{emailSendFailed ? 'We could not send your confirmation email' : 'Confirm your email address'}</h2>
            <p>{emailSendFailed
              ? 'Supabase is temporarily limiting confirmation emails. Your registration may not have completed, so please do not keep submitting the form. Wait before trying again or contact the administrator.'
              : confirmationRequired
                ? "We've received your registration request. Open the confirmation email sent to:"
                : 'Your Contribution Circle account has been created successfully. You can continue to add your bank details.'}</p>
            {(confirmationRequired || emailSendFailed) && <strong className="email-modal-address">{registeredEmail}</strong>}
            {!emailSendFailed && confirmationRequired && <p>Click the confirmation link to activate your account. Check your spam or junk folder if you cannot find it.</p>}
            <Link className="btn btn-primary email-modal-button" href={emailSendFailed || confirmationRequired ? '/login' : '/onboarding/bank'}>
              {emailSendFailed || confirmationRequired ? 'Go to login' : 'Continue to bank details'}
            </Link>
            <button className="email-modal-close" type="button" onClick={() => setShowEmailConfirmation(false)}>Close</button>
          </section>
        </div>
      )}
    </>
  );
}
