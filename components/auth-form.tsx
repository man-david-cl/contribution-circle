'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');

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

        if (signUpError) throw signUpError;

        if (data.session) {
          window.location.assign('/onboarding/bank');
          return;
        }

        setNotice('Your account has been created. Check your email and confirm your address using the link we sent. After confirmation, you can log in and add your bank details.');
        form.reset();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
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
      {notice && <div className="auth-message auth-success" role="status">{notice}</div>}

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
  );
}
