'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function BankSetup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const f = new FormData(e.currentTarget);

      const bankName = String(f.get('bank_name') ?? '').trim();
      const accountName = String(f.get('bank_account_name') ?? '').trim();
      const accountNumber = String(f.get('bank_account_number') ?? '').trim();

      if (!bankName || !accountName || !accountNumber) {
        setError('Please complete all bank details.');
        return;
      }

      if (!/^\d{10}$/.test(accountNumber)) {
        setError('Please enter a valid 10-digit account number.');
        return;
      }

      const s = createClient();
      const {
        data: { user },
        error: authError,
      } = await s.auth.getUser();

      if (authError || !user) {
        window.location.href = '/login';
        return;
      }

      const { data: profile, error: updateError } = await s
        .from('profiles')
        .update({
          bank_name: bankName,
          bank_account_name: accountName,
          bank_account_number: accountNumber,
        })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (!profile) {
        setError('Your profile was not updated. Please contact support.');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Something went wrong while saving your bank details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <form onSubmit={save} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bank details</h1>
          <p className="mt-1 text-sm text-slate-600">Add your bank information to complete onboarding.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700">
            Bank name
          </label>
          <input
            id="bank_name"
            name="bank_name"
            type="text"
            autoComplete="organization"
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-slate-500"
            placeholder="Example Bank"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_account_name" className="block text-sm font-medium text-slate-700">
            Account name
          </label>
          <input
            id="bank_account_name"
            name="bank_account_name"
            type="text"
            autoComplete="name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-slate-500"
            placeholder="Your full name"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_account_number" className="block text-sm font-medium text-slate-700">
            Account number
          </label>
          <input
            id="bank_account_number"
            name="bank_account_number"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-slate-500"
            placeholder="1234567890"
            maxLength={10}
            required
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Save bank details'}
        </button>
      </form>
    </main>
  );
}

